# Jenkins Console Output popup

Open Jenkins through the private gateway at `http://127.0.0.1:8090/` (with SSH forwarding to the EC2 server). Sign in to Jenkins, then open any build's **Console Output** page. JenkinsAI appears at bottom right and automatically inspects that build. It does not appear on dashboards or other pages.

The popup shows the Jenkins build result and a separate AI verdict: clean, issue found, failed, or review needed. A `SUCCESS` build can still show **Hidden issue** when its log has evidence of an unresolved error. The popup includes a short explanation, one evidence line, and one next step. While a build runs, it checks again every 15 seconds. The robot toggles the popup; **Check again** requests the result again. Completed diagnoses are cached in server memory.

Opening Console Output sends a redacted, bounded log excerpt to Gemma automatically. There is no chat box, token field, or manual log-sharing step in the UI. The gateway checks the Jenkins browser session and adds the assistant token server-side. The backend reads Jenkins with its dedicated reader account, so gateway users can analyze every job visible to that account. Restrict the reader to trusted demo jobs. Redaction is best-effort and large logs may be incomplete.

The gateway injects `frontend/widget.js` into Jenkins pages, but the script mounts only on `/job/.../<build>/console` and `/consoleFull`. Direct Jenkins port `8080` does not include the popup. See [gateway setup](MONITORING.md).
