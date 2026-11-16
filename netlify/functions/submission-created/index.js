/* Netlify event function. The directory name binds this to form
   submission-created. It ignores every form except pool-quiz, and the
   SMS module sends nothing unless QUO_API_KEY is set and CONTEXT is
   production (deploy previews never text).

   Quo payload, from their public OpenAPI for POST /v1/messages
   (https://www.quo.com/docs/mdx/api-reference/messages/send-a-text-message):
   JSON { content, from, to: [E.164] } and an Authorization header that
   is the raw API key (not "Bearer"). Success is HTTP 202.
   `from` may be E.164 or a Quo phone-number id (PN…). userId is omitted
   so the message is attributed to the number owner. setInboxStatus is
   omitted so the thread stays open in the inbox.
   This was not executed against a live Quo account. */

const { createHandler } = require("./quiz-sms");

const handler = createHandler();

exports.handler = handler;
exports.default = handler;
