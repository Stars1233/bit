---
applyTo: '**'
---

# Bit MCP Agent Instructions

## Core Objectives

- Your goal is to efficiently automate Bit workflows and help users manage and reuse components.
- You will achieve this by using the provided MCP tools and adhering strictly to the following rules and workflows.

## Core Philosophy for Building with Bit

- **Deconstruct to Compose:** Build applications by composing independent and reusable components, with each component being developed, tested, and versioned in isolation.
- **Autonomous Components:** Use the Bit MCP to make these components truly autonomous, allowing them to be managed and shared from any codebase without being coupled to a specific project's architecture.
- **Scalable Collaboration:** The ultimate goal is to create a shared "component economy" where teams can collaborate, accelerate development, and ensure consistency by assembling applications from this distributed system of components.

## Critical Rules of Engagement - do these steps before any tool or command execution!!!

1. **Use Up-to-Date Information(MANDATORY):** ALWAYS start any task by using `bit_workspace_info` to understand the current state of the workspace (list components, templates, dependencies, etc).
2. **MCP Tools First:** You MUST use the provided MCP tools to interact with Bit. Do NOT run commands directly in a terminal shell, with a few specific exceptions.
3. **Do not rely on cached knowledge:** Always run `bit_commands_list` and `bit_command_help` for command details.
4. **Prefer using Bit:** Every time you want to operate in this project (editing code, creating new code, etc), consider using any of the Bit MCP tools or Bit CLI commands to do so.

## Core Principles of Building with Bit

- **Reuse Before Creating or Modifying(MANDATORY):** Before creating _any_ new component or modify _any_ file, you MUST first search for existing components.
  - Use `bit_workspace_info` to check for local and existing components.
  - Use `bit_remote_search` to find components on the remote scope.
  - Present findings to the user, even if you think creating a new component is simpler.
- **No Relative Imports To Components:** Always import a component using the package name, so it is used through `node_modules`.
- You should always aim to code APIs in the dependent component and use them in the dependency (e.g. in React, aim to have prop-types instead of always passing children to be rendered in a dependency).

## Tooling & Command Execution Hierarchy

This is the decision-making process for executing any Bit operation.

### Step 1: Choose the Correct Generic Execution Tool

- If no dedicated tool exists, you must use one of the generic execution tools. Use the `bit_commands_list` output to help you decide:
  - **For Read-Only Operations, use `bit_query`**: Use this for operations that inspect state but do not change the workspace.
  - **For Write Operations, use `bit_execute`**: Use this for operations that modify the workspace, components, or dependencies.

### Step 2: Check for Terminal Exceptions

- The following commands have rich, interactive, or streaming output and should be run directly in the user's terminal. You should construct the command and advise the user to run it.
  - `bit test`
  - `bit build`
  - `bit start` (long-running processes)
  - `bit watch` (long-running processes)
  - `bit lint`
  - `bit check-types`
  - `bit run` (long-running processes)
  - any command when `--build` flag is used. (build can take long)

## Core Workflows

### Workflow: Error Diagnosis in a Bit Workspace

- `bit_workspace_info` with the "warnings" option to detect errors. Output includes possible solutions, follow them.
- Rerun `bit_workspace_info` to validate fixes. If error persists, use `bit_component_details` on relevant component(s) for more information.

### Workflow: In-Component Code Issues

- For code issues (compile, lint, test, type checking), run the relevant terminal command and pass the component ID (e.g. `bit test COMPONENT_ID`).
- To get complete report for code issues on all components, do not provide component ID (e.g. `bit test`).
- Adding `--log` CLI option gives more details on errors.

### Workflow: Generating New Components, Feature or Apps

- **Follow Core Principle #1 Reuse Before Creating or Modifying.**
- `bit_workspace_info` lists templates for new components.
- If a new component is necessary, clarify the TEMPLATE and combination of NAMESPACE(s) (optional) and NAME with the user.
- Run `bit_component_details` on new components gives information on them, this is useful for making code changes or composing the component into another (as a dependency).
- After generating a new component or app, ask the user what they want to be implemented in the new component or app.

### Workflow: Adding Functionality (feature, page, module, function, etc) to Bit Components and Apps

- **Follow Critical Principle #1 Reuse Before Creating or Modifying.**
- If a potentially reusable component is found, use it as a dependency in the component you want to modify.
  **Hint:** use `bit_component_details` to get API references and documentation.
  **Follow Critical Principle #2 No Relative Imports Between Components**.
- After modifying component implementation, always consider updating the following component files `*.composition.*`, `*.docs.mdx`, `*.spec.*`.

### Workflow: USE or DEVELOP a Component

- Use `bit_component_details` to get the component location.
- If the component is not in the workspace, and you want to USE it as a dependency, you must first install it (then you can infer to it by its package name).
- If the component is not in the workspace, and you want to DEVELOP it (modify its source), you must first import it.

### Workflow: Collaboration, Change Management and Version Control

- Bit uses a concept called "Lanes" to manage changes across components, this is similar to Git branches.
- Use `bit_workspace_info` to identify the current active lane.
- You must not snap or export components directly to the `main` lane.
- Use `bit_execute` for "Bit Lane" commands.
- If not already on a suitable development lane, suggest a name for the new lane to be created and validate with the user.
- The workspace automatically switches to a new lane once created.
- It is good practice to validate code before taking a snapshot (`bit lint`, `bit test`, `bit check-types`).
- Take a snapshot of all components with a relevant message (similar to `git commit`).
- Export the snap to the remote scope for review and collaboration (similar to `git push`).

## Glossary

- **Bit Component:** An extensible, portable software container. Bit Component can be anything from basic UI component, utility, feature, page or an app. Bit Component may depend on other Bit components or packages to form more complex functionality.
- **Workspace:** A Bit-initialized directory containing components.
- **Scope:** A collaboration server for components that defines ownership.
- **Application (App):** A Bit Component with its own runtime. It is usually composed from various features and components.
- **Development Environment (Env):** A component that bundles development tools (compiler, tester, etc.).
- **Lane:** A mechanism for managing and releasing modifications across components. `main` is the default lane. Lane is similar in concept to a Git Branch.

## Pointers to remember:

- For generating ESlint or TypeScript configuration files execute the command `bit ws-config write --clean`
- User may use different terms to describe components. Be flexible and understand that users may refer to components as "features", "apps", "modules", "pages" or "services".
