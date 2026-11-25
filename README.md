<p align="center">
  <img src="src/assets/logo.svg" width="72" alt="Project Pulse logo">
</p>

<h1 align="center">Project Pulse</h1>
<p align="center"><strong>Status at a glance.</strong></p>
<p align="center">
  <img src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="JavaScript">
</p>

A lightweight synthetic monitoring dashboard that transforms cloud service availability and API response times into a clear view of application health.

## Health indicators

| Status | Meaning |
| :--- | :--- |
| 🟢 **Healthy** | Successful checks within the performance threshold. |
| 🟡 **Warning** | Degraded performance, partial failure, overdue or incomplete monitoring data. |
| 🔴 **Critical** | Complete dependency check failure. |

## Features

- Containerized monitoring with Docker and non-root execution.
- Three-pulse sampling for availability and response-time analysis.
- Consistent health classification across dependencies, applications and the system.
- Interactive diagnostics with HTTP status codes and individual response times.
- Automatically refreshed results with live elapsed-time indicators.
- Automated tests for monitoring and health classification.
- Hourly monitoring and deployment through GitHub Actions and GitHub Pages.
- Freshness protection that flags results as overdue after two hours.

## How it works

```mermaid
flowchart TD
    G["Version control · Git"] --> T["Automated testing · Node.js"]
    T --> D["Containerized execution · Docker"]
    G --> A["CI/CD · GitHub Actions"]
    A --> T
    A --> D
    C["Cloud services · REST APIs"] --> M["Synthetic monitoring"]
    D --> M
    M --> S["Health classification · Status snapshot"]
    S --> U["Interactive health dashboard"]
    A --> P["Automated deployment · GitHub Pages"]
    S --> P
    P --> U
    U --> H["Healthy"] & W["Warning"] & R["Critical"]
    style D fill:#164e63,color:#fff,stroke:#2496ed
    style H fill:#166534,color:#fff,stroke:#22c55e
    style W fill:#854d0e,color:#fff,stroke:#eab308
    style R fill:#991b1b,color:#fff,stroke:#ef4444
```

Project Pulse separates monitoring execution from presentation, turning cloud measurements into a consistent view of application health. Automated tests validate the monitoring and classification logic.

GitHub Actions runs the monitoring worker hourly and supports manual execution. GitHub Pages serves the resulting dashboard; local execution uses the same monitoring worker and dashboard.

## Local development

Requires Node.js 22 or a compatible runtime. Docker is required for containerized execution.

```sh
npm test
npm run dev
```

Monitoring targets and credentials are configured separately from the dashboard.
