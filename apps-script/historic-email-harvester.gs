/**
 * No Dice CRM — historic email harvester (ONE-OFF)
 * =====================================================================
 * Run this ON the info@plonkgolf.co.uk account (the old Plonk inbox that holds
 * the 2019-2025 client mail). It sweeps the whole mailbox, pulls every
 * person's name + email, and sends them to the CRM, which matches them onto
 * the historic enquiry list so those old clients become re-targetable.
 *
 * ADD IT (doesn't touch your scanner):
 *   1. In the info@plonkgolf.co.uk Apps Script project, click the + next to
 *      "Files" -> Script, name it anything (e.g. "harvest").
 *   2. Paste ALL of this into that new file. Save.
 *   3. Run the function "harvestHistoricEmails" once. Approve if asked.
 *   It then keeps itself going every minute until the whole mailbox is done
 *   (you'll see "HARVEST COMPLETE" in the log), then stops on its own.
 *   Nothing to fill in.
 * =====================================================================
 */

var HARVEST_ENDPOINT = "https://rntcujcpsozvuxvmlejv.supabase.co/functions/v1/email-index";
var HARVEST_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJudGN1amNwc296dnV4dm1sZWp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0Nzk0MDIsImV4cCI6MjA5NjA1NTQwMn0.cUMy2GWme7quwDKns_sXq8OY-9SqWaIuZqhYSz3ZwrY";
var HARVEST_APP_TAG = "nodice-crm-scanner";

var HARVEST_BATCH = 120;       // threads per step
var HARVEST_MAX_SECONDS = 270; // stop a step before Apps Script's 6-min limit

function harvestHistoricEmails() {
  // (re)install a 1-min continuation trigger, reset progress, run first step.
  removeHarvestTriggers_();
  PropertiesService.getScriptProperties().setProperty("harvest_cursor", "0");
  ScriptApp.newTrigger("harvestStep").timeBased().everyMinutes(1).create();
  Logger.log("Harvest started on " + harvestWho_() + " — will run itself until complete.");
  harvestStep();
}

function harvestStep() {
  var props = PropertiesService.getScriptProperties();
  var cursor = parseInt(props.getProperty("harvest_cursor") || "0", 10);
  var start = new Date().getTime();
  var posted = 0, threadsDone = 0;

  while ((new Date().getTime() - start) / 1000 < HARVEST_MAX_SECONDS) {
    var threads = GmailApp.search("in:anywhere", cursor, HARVEST_BATCH);
    if (!threads.length) {
      removeHarvestTriggers_();
      Logger.log("HARVEST COMPLETE on " + harvestWho_() + " — swept " + cursor + " threads.");
      props.deleteProperty("harvest_cursor");
      return;
    }
    var pairs = {};
    for (var t = 0; t < threads.length; t++) {
      var msgs = threads[t].getMessages();
      for (var m = 0; m < msgs.length; m++) {
        collectPairs_(msgs[m].getFrom(), pairs);
        collectPairs_(msgs[m].getTo(), pairs);
        collectPairs_(msgs[m].getCc(), pairs);
      }
    }
    posted += postPairs_(pairs);
    cursor += threads.length;
    threadsDone += threads.length;
    props.setProperty("harvest_cursor", String(cursor));
  }
  Logger.log("Step done — " + threadsDone + " threads this run (cursor " + cursor +
             "), " + posted + " name/email pairs sent. Continuing next minute…");
}

// ---- helpers ----
function harvestWho_() {
  return Session.getActiveUser().getEmail() ||
         Session.getEffectiveUser().getEmail() || "unknown";
}
function removeHarvestTriggers_() {
  var trs = ScriptApp.getProjectTriggers();
  for (var i = 0; i < trs.length; i++) {
    if (trs[i].getHandlerFunction() === "harvestStep") ScriptApp.deleteTrigger(trs[i]);
  }
}
// Parse a header like '"Jane Doe" <jane@x.com>, bob@y.com' into name->email.
function collectPairs_(header, out) {
  if (!header) return;
  var parts = String(header).split(",");
  for (var i = 0; i < parts.length; i++) {
    var s = parts[i].trim();
    if (!s) continue;
    var m = s.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
    var name = "", email = "";
    if (m) { name = (m[1] || "").trim(); email = (m[2] || "").trim(); }
    else if (s.indexOf("@") !== -1) { email = s.replace(/[<>]/g, "").trim(); }
    email = email.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    if (!name || name.indexOf("@") !== -1) continue; // need a real display name
    out[name + "|" + email] = { name: name, email: email };
  }
}
function postPairs_(pairsObj) {
  var all = [];
  for (var k in pairsObj) all.push(pairsObj[k]);
  var sent = 0;
  for (var i = 0; i < all.length; i += 200) {
    var chunk = all.slice(i, i + 200);
    try {
      UrlFetchApp.fetch(HARVEST_ENDPOINT, {
        method: "post",
        contentType: "application/json",
        headers: { "apikey": HARVEST_ANON_KEY, "Authorization": "Bearer " + HARVEST_ANON_KEY },
        payload: JSON.stringify({ app: HARVEST_APP_TAG, pairs: chunk }),
        muteHttpExceptions: true
      });
      sent += chunk.length;
    } catch (e) {
      Logger.log("post error: " + e);
    }
  }
  return sent;
}
