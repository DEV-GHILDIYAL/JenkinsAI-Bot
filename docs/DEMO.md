# Three-minute demo

1. Open the private Jenkins gateway at `http://127.0.0.1:8090/` and sign in.
2. Open a failed build's **Console Output**. The bottom-right robot shows a short AI diagnosis with one cited line and next step. No chat or token entry is needed.
3. Open a successful build whose console contains a real unresolved error. JenkinsAI should show **Jenkins: SUCCESS · Hidden issue** and explain the evidence. Contrast with a clean successful build.
4. Open a running build's console. JenkinsAI waits and checks again every 15 seconds after completion.
5. Show that the backend reads Jenkins with GET requests and cannot trigger builds or change pipeline configuration. The model only suggests what a person should verify.

Use live mode to demonstrate Gemma. Demo mode gives canned fixture data and makes no model call. Restrict the reader account to trusted jobs because opening Console Output automatically sends a redacted excerpt to Gemma.
