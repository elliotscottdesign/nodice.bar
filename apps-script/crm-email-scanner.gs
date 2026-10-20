/**
 * No Dice CRM — email enquiry scanner (Google Apps Script)
 * =====================================================================
 * Paste this into a Google Apps Script project on EACH inbox you want
 * scanned (info@nodice.bar AND info@plonkgolf.co.uk), then run setup()
 * once and authorise it. It auto-detects which inbox it's on.
 *
 * Every 15 minutes it looks at recent inbox emails that look like party /
 * event enquiries, and posts each one to the CRM — where it shows up as a
 * 'new' enquiry on the board (team.nodice.bar → No Dice Admin → Enquiries).
 * Emails it has already sent are labelled "CRM Logged" and skipped, and the
 * CRM also dedupes server-side, so nothing is ever posted twice.
 *
 * ONE-TIME SETUP (per account):
 *   1. Go to script.google.com (signed in as that inbox), New project.
 *   2. Delete the sample code, paste ALL of this.
 *   3. Put the real secret in SECRET below (replace PASTE_SECRET_HERE).
 *   4. Run the function "setup" once. Approve the permissions prompt.
 *   That's it — it then runs itself every 15 minutes.
 * =====================================================================
 */

// ---- CONFIG ----------------------------------------------------------
var ENDPOINT = "https://rntcujcpsozvuxvmlejv.supabase.co/functions/v1/email-enquiry";
// Public anon key (safe to embed — this is the same key the website uses).
var ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJudGN1amNwc296dnV4dm1sZWp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0Nzk0MDIsImV4cCI6MjA5NjA1NTQwMn0.cUMy2GWme7quwDKns_sXq8OY-9SqWaIuZqhYSz3ZwrY";
// Shared secret — REPLACE with the value Claude gave you. Keep it private.
var SECRET = "PASTE_SECRET_HERE";

var LABEL_NAME = "CRM Logged";
var LOOKBACK = "newer_than:3d"; // how far back each run looks
var MAX_THREADS = 40;          // safety cap per run

// Only treat an email as an enquiry if the subject/body mentions one of
// these. Generous on purpose; edit to taste. Leave the array empty ([]) to
// capture EVERYTHING in the inbox (you'd then triage harder on the board).
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
  "google.com", "accounts.google", "calendar-notification", "resend.com"
];

// ---- ONE-TIME SETUP --------------------------------------------------
function setup() {
  getOrCreateLabel_();
  // Remove any old triggers for this function, then install a fresh one.
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "scanInbox") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger("scanInbox").timeBased().everyMinutes(15).create();
  Logger.log("Setup complete for " + whoAmI_() + " — scanning every 15 min.");
  // Do an immediate first pass so you can see it working.
  scanInbox();
}

// ---- MAIN SCAN -------------------------------------------------------
function scanInbox() {
  if (SECRET === "PASTE_SECRET_HERE" || !SECRET) {
    Logger.log("SECRET not set — edit the SECRET value and run setup() again.");
    return;
  }
  var inbox = whoAmI_();
  var label = getOrCreateLabel_();
  var query = 'in:inbox ' + LOOKBACK +
    ' -label:"' + LABEL_NAME + '"' +
    ' -category:promotions -category:social -category:forums';
  var threads = GmailApp.search(query, 0, MAX_THREADS);
  var logged = 0;

  for (var t = 0; t < threads.length; t++) {
    var thread = threads[t];
    var messages = thread.getMessages();
    if (!messages.length) continue;

    // Use the FIRST inbound message in the thread (the original enquiry),
    // not our own replies.
    var msg = null;
    for (var m = 0; m < messages.length; m++) {
      var fromAddr = parseEmail_(messages[m].getFrom()).email.toLowerCase();
      if (fromAddr && fromAddr !== inbox.toLowerCase()) { msg = messages[m]; break; }
    }
    if (!msg) { thread.addLabel(label); continue; }

    var from = parseEmail_(msg.getFrom());
    var subject = msg.getSubject() || "";
    var body = (msg.getPlainBody() || "").slice(0, 8000);

    if (shouldSkipSender_(from.email) || !looksLikeEnquiry_(subject + " " + body)) {
      thread.addLabel(label); // mark seen so we don't re-check it forever
      continue;
    }

    var payload = {
      secret: SECRET,
      gmail_message_id: msg.getId(),
      from_name: from.name,
      from_email: from.email,
      subject: subject,
      body: body,
      received_at: msg.getDate().toISOString(),
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
  Logger.log("Scan done for " + inbox + " — " + logged + " new enquiry email(s) logged.");
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
  // "Jane Doe <jane@x.com>"  ->  { name: "Jane Doe", email: "jane@x.com" }
  var m = (fromHeader || "").match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: (m[1] || "").trim(), email: (m[2] || "").trim() };
  return { name: "", email: (fromHeader || "").trim() };
}
function shouldSkipSender_(email) {
  var e = (email || "").toLowerCase();
  if (!e) return true;
  for (var i = 0; i < SKIP_FROM.length; i++) {
    if (e.indexOf(SKIP_FROM[i]) !== -1) return true;
  }
  return false;
}
function looksLikeEnquiry_(text) {
  if (!ENQUIRY_WORDS.length) return true; // empty list = capture everything
  var t = (text || "").toLowerCase();
  for (var i = 0; i < ENQUIRY_WORDS.length; i++) {
    if (t.indexOf(ENQUIRY_WORDS[i]) !== -1) return true;
  }
  return false;
}
