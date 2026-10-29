/**
 * No Dice CRM — email enquiry scanner (Google Apps Script)
 * =====================================================================
 * Runs on Google's servers every 5 minutes, with no manual work, and turns
 * genuine new enquiry emails into enquiries on the CRM board
 * (team: No Dice Admin -> Enquiries). This ONE script, installed on the
 * elliot@nodice.bar account, covers BOTH inboxes, because info@nodice.bar
 * AND info@plonkgolf.co.uk mail both land in that account.
 *
 * It is deliberately careful:
 *  - It IGNORES your own replies (anything sent from your own addresses).
 *  - It handles FORWARDED enquiries (Fwd: ...) by pulling the real
 *    enquirer's name/email out of the forwarded text.
 *  - It skips automated / bulk / no-reply senders and promo/social tabs.
 *  - Everything it logs gets a "CRM Logged" Gmail label and a server-side
 *    dedupe, so nothing is ever posted twice.
 *
 * ONE-TIME SETUP (do it once, then never again):
 *   1. In the Apps Script editor, click in the code, Select All, Delete.
 *   2. Paste ALL of this. (Nothing to fill in — it's ready as-is.)
 *   3. Save, then Run the function "setup" once. (If it asks to authorise,
 *      allow it — it's your own script reading your own mail.)
 *   That's it. It then runs itself every 5 minutes.
 * =====================================================================
 */

// ---- CONFIG ----------------------------------------------------------
var ENDPOINT = "https://rntcujcpsozvuxvmlejv.supabase.co/functions/v1/email-enquiry";
// Public anon key (safe to embed — same key the website uses).
var ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJudGN1amNwc296dnV4dm1sZWp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0Nzk0MDIsImV4cCI6MjA5NjA1NTQwMn0.cUMy2GWme7quwDKns_sXq8OY-9SqWaIuZqhYSz3ZwrY";
// Fixed tag the CRM expects. Baked in — nothing to fill in or change.
var APP_TAG = "nodice-crm-scanner";

var LABEL_NAME = "CRM Logged";
var LOOKBACK = "newer_than:3d"; // how far back each run looks
var MAX_THREADS = 50;           // safety cap per run

// YOUR OWN addresses — mail sent FROM these is never logged as an enquiry
// (they're your replies), but a Fwd: from one of them IS read for the
// original enquirer inside it. Add any other staff "send as" addresses here.
var SELF_ADDRESSES = [
  "info@nodice.bar",
  "info@plonkgolf.co.uk",
  "elliot@nodice.bar",
  "rhys@nodice.bar"
];

// Only treat an email as an enquiry if the subject/body mentions one of these.
// Generous on purpose. Leave the array empty ([]) to capture everything.
var ENQUIRY_WORDS = [
  "party", "parties", "book", "booking", "reserve", "reservation",
  "event", "enquir", "inquir", "hire", "private", "function", "birthday",
  "celebrat", "christmas", "xmas", "corporate", "work do", "table",
  "group", "availab", "quote", "deposit", "tournament", "pool", "golf",
  "ping pong", "bingo", "dj", "hen", "stag", "leaving do", "anniversary"
];

// Senders we never turn into enquiries (automated / bulk).
var SKIP_FROM = [
  "no-reply", "noreply", "no_reply", "donotreply", "do-not-reply",
  "mailer-daemon", "postmaster", "notifications@", "notification@",
  "bounce", "newsletter", "mailchimp", "sendgrid", "stripe.com",
  "accounts.google", "calendar-notification", "resend.com", "squarespace"
];

// ---- ONE-TIME SETUP --------------------------------------------------
function setup() {
  getOrCreateLabel_();
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "scanInbox") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger("scanInbox").timeBased().everyMinutes(5).create();
  Logger.log("Setup complete for " + whoAmI_() + " — scanning every 5 min.");
  scanInbox();
}

// ---- MAIN SCAN -------------------------------------------------------
function scanInbox() {
  var inbox = whoAmI_();
  var label = getOrCreateLabel_();
  var query = 'in:inbox ' + LOOKBACK +
    ' -label:"' + LABEL_NAME + '"' +
    ' -category:promotions -category:social -category:forums';
  var threads = GmailApp.search(query, 0, MAX_THREADS);
  var logged = 0, skipped = 0;

  for (var t = 0; t < threads.length; t++) {
    var thread = threads[t];
    var messages = thread.getMessages();
    if (!messages.length) { thread.addLabel(label); continue; }

    var picked = pickEnquiryMessage_(messages);
    if (!picked) { thread.addLabel(label); skipped++; continue; }

    var subject = picked.msg.getSubject() || "";
    var body = (picked.msg.getPlainBody() || "").slice(0, 8000);

    if (!looksLikeEnquiry_(subject + " " + body)) {
      thread.addLabel(label); skipped++; continue;
    }

    var payload = {
      app: APP_TAG,
      gmail_message_id: picked.msg.getId(),
      from_name: picked.name,
      from_email: picked.email,
      subject: subject,
      body: body,
      received_at: picked.msg.getDate().toISOString(),
      source_inbox: inbox
    };

    try {
      var res = UrlFetchApp.fetch(ENDPOINT, {
        method: "post",
        contentType: "application/json",
        headers: { "apikey": ANON_KEY, "Authorization": "Bearer " + ANON_KEY },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
      var code = res.getResponseCode();
      if (code >= 200 && code < 300) {
        thread.addLabel(label);
        logged++;
      } else {
        Logger.log("Post failed (" + code + "): " + res.getContentText());
      }
    } catch (e) {
      Logger.log("Error posting: " + e);
    }
  }
  Logger.log("Scan done for " + inbox + " — " + logged + " logged, " + skipped + " skipped.");
}

// ---- PICK THE RIGHT MESSAGE -----------------------------------------
// Returns { msg, name, email } for the enquiry in a thread, or null to skip.
// Rules:
//  - A Fwd: from one of YOUR addresses => read the ORIGINAL enquirer from the
//    forwarded body ("From: Name <email>"). That's a real enquiry you passed on.
//  - Otherwise => the first message from an EXTERNAL sender (not one of yours,
//    not an automated/bulk sender).
//  - A thread that is only your own non-forwarded replies => skip.
function pickEnquiryMessage_(messages) {
  for (var i = 0; i < messages.length; i++) {
    var m = messages[i];
    var from = parseEmail_(m.getFrom());
    var fromLc = (from.email || "").toLowerCase();
    var subj = (m.getSubject() || "");
    var isSelf = isSelfAddress_(fromLc);

    if (isSelf) {
      // Only interesting if it's a forward carrying someone else's enquiry.
      if (/^\s*fwd:/i.test(subj)) {
        var orig = parseForwardedSender_(m.getPlainBody() || "");
        if (orig && !isSelfAddress_(orig.email.toLowerCase()) &&
            !shouldSkipSender_(orig.email)) {
          return { msg: m, name: orig.name, email: orig.email };
        }
      }
      continue; // your own reply — ignore
    }

    if (shouldSkipSender_(fromLc)) continue; // automated/bulk
    return { msg: m, name: from.name, email: from.email };
  }
  return null;
}

// ---- HELPERS ---------------------------------------------------------
function whoAmI_() {
  return Session.getActiveUser().getEmail() ||
         Session.getEffectiveUser().getEmail() || "unknown";
}
function getOrCreateLabel_() {
  return GmailApp.getUserLabelByName(LABEL_NAME) ||
         GmailApp.createLabel(LABEL_NAME);
}
function parseEmail_(fromHeader) {
  var m = (fromHeader || "").match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: (m[1] || "").trim(), email: (m[2] || "").trim() };
  return { name: "", email: (fromHeader || "").trim() };
}
// Find the first "From: Name <email>" inside a forwarded message body.
function parseForwardedSender_(body) {
  var m = (body || "").match(/From:\s*"?([^"<\n]*?)"?\s*<([^>\s]+@[^>\s]+)>/i);
  if (m) return { name: (m[1] || "").trim(), email: (m[2] || "").trim() };
  // Fallback: a bare "From: someone@x.com"
  var m2 = (body || "").match(/From:\s*([^\s<]+@[^\s>]+)/i);
  if (m2) return { name: "", email: m2[1].trim() };
  return null;
}
function isSelfAddress_(email) {
  var e = (email || "").toLowerCase();
  for (var i = 0; i < SELF_ADDRESSES.length; i++) {
    if (e === SELF_ADDRESSES[i].toLowerCase()) return true;
  }
  return false;
}
function shouldSkipSender_(email) {
  var e = (email || "").toLowerCase();
  if (!e) return true;
  if (isSelfAddress_(e)) return true;
  for (var i = 0; i < SKIP_FROM.length; i++) {
    if (e.indexOf(SKIP_FROM[i]) !== -1) return true;
  }
  return false;
}
function looksLikeEnquiry_(text) {
  if (!ENQUIRY_WORDS.length) return true;
  var t = (text || "").toLowerCase();
  for (var i = 0; i < ENQUIRY_WORDS.length; i++) {
    if (t.indexOf(ENQUIRY_WORDS[i]) !== -1) return true;
  }
  return false;
}
