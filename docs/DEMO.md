# Three-minute demo

1. **Problem (20 seconds):** A failed build produces console noise. JenkinsAI explains evidence and suggests reviewed next steps, with an open-weight model accessible through a web widget.
2. **Evidence (40 seconds):** Open the assistant in Jenkins (or standalone), select a job and failed build, preview the redacted numbered log excerpt. Point out that previewing does not call Google. Review for secrets.
3. **Analysis (60 seconds):** Enable log sharing, ask for the root cause. Show quoted line numbers, suggested verification, fix, Jenkinsfile improvement, and uncertainty. Ask a follow-up such as “Why shouldn't I chmod the Docker socket?” No command is executed.
4. **General help (30 seconds):** Turn off log sharing, clear the chat, then ask “Explain Jenkins credentials binding and avoiding shell interpolation.”
5. **Coding assistant (20 seconds):** Run `terminal_assistant.py`, preview a source file with `/file`, consent with `/attach`, and ask for a proposed improvement.
6. **Open source (10 seconds):** Show the public GitHub repo, MIT license, tests, and clear boundaries: GET-only Jenkins access, no production actions, best-effort redaction, human review.

Use **live mode** for the actual model demo. The offline fixture is only rehearsal/fallback and must be identified as canned. Do not claim it proves model quality or live API integration.

Optional Docker failure fixture (create manually in a disposable Jenkins job only):

```groovy
pipeline {
  agent any
  stages {
    stage('Demo failure') {
      steps {
        echo 'ERROR: permission denied while trying to connect to the Docker daemon socket'
        error('Intentional hackathon failure; no deployment performed')
      }
    }
  }
}
```

Label this as synthetic, not an actual Docker daemon test. Do not run it in a production pipeline. The assistant never creates or triggers this job.
