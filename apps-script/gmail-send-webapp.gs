/**
 * No Dice CRM — Gmail send endpoint (Option B)
 * =====================================================================
 * Deploy this ON info@nodice.bar so CRM replies send THROUGH Gmail — they then
 * appear in your Sent folder and thread into the original conversation.
 *
 * SETUP (one-off):
 *   1. New Apps Script project (script.google.com) signed in as info@nodice.bar
 *      — or add it as a new file to your existing scanner project there.
 *   2. Paste ALL of this. Save.
 *   3. Deploy -> New deployment -> gear icon -> "Web app".
 *        Description: anything.  Execute as: Me (info@nodice.bar).
 *        Who has access: Anyone.
 *      Click Deploy, approve permissions, and COPY the "Web app URL".
 *   4. Send that URL to Claude — it wires it into the CRM and replies start
 *      going through Gmail. (Until then, replies still send fine the old way.)
 * =====================================================================
 */

var SEND_APP_TAG = "nodice-crm-scanner";
var SEND_NAME = "No Dice";

function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return sendOut_({ error: "bad json" }); }
  if (!body || body.app !== SEND_APP_TAG) return sendOut_({ error: "unauthorized" });

  var to = (body.to || "").trim();
  var subject = body.subject || "No Dice";
  var text = body.body || "";
  var html = body.html || "";
  var replyId = (body.reply_to_message_id || "").trim();

  try {
    if (replyId) {
      // Reply into the original thread (keeps it threaded + in Sent).
      var msg = null;
      try { msg = GmailApp.getMessageById(replyId); } catch (e2) { msg = null; }
      if (msg) {
        msg.reply(text, { htmlBody: html, name: SEND_NAME });
        return sendOut_({ ok: true, mode: "reply" });
      }
    }
    if (!to) return sendOut_({ error: "no recipient" });
    GmailApp.sendEmail(to, subject, text, { htmlBody: html, name: SEND_NAME });
    return sendOut_({ ok: true, mode: "new" });
  } catch (err) {
    return sendOut_({ error: String(err) });
  }
}

// A GET confirms the endpoint is alive AND which account it sends from.
// Open the Web app URL in a browser — it should show "info@nodice.bar".
function doGet() {
  var who = "";
  try { who = Session.getEffectiveUser().getEmail(); } catch (e) { who = "unknown"; }
  return sendOut_({ ok: true, service: "nodice-crm-gmail-send", sends_from: who });
}

// Run this ONCE in the editor to grant the Gmail *send* permission. It sends a
// confirmation email to yourself; approve the permission prompt when it appears.
function grantAccess() {
  var me = Session.getEffectiveUser().getEmail();
  GmailApp.sendEmail(me, "No Dice CRM — send access granted",
    "Gmail send is now authorised. The CRM can reply from this account.");
  Logger.log("Sent a confirmation to " + me + " — send access granted.");
}

function sendOut_(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}
