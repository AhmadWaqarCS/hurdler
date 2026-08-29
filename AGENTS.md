This is an AI agentic coding project. This is queit different from all other agents out there.

The purpose of this project is to provide a robust environment to the LLMs to function in their own capabilities. An LLM cannot reason for a 1 million context codebase. It cannot reason for different abstract features to write code. However larger LLMs have more capability to do better, but they cost more, so this project fits all LLMs and their coding capabilities, to put them to use with full potential. Not only will the LLMs create codebases from scratch, but also redesign, or work on existing codebases. This project gives LLMs full support to work as a senior expert software engineer. This project is created in Node.JS.

This agent can support all model providers, any API endpoints they provide like priority, flex, standard. The models can be configured for their thinking ability and cost. Token, and cost usage statistics are also available for this project. This will be a static LLM registry.

There will be many global, and system prompts, whose sole purpose is giving the LLMs a thought process to think through, for example, "Follow KISS philosophy", "create business logic", "create validations", "apply security patches".

There will be many default agents in this project, all doing different tasks, with different system prompts guiding them. For example, a business logic creator, a UI designer, a database manager, an orchestrator, a tester, a debugger and a security reviewer.

There is a full use of git source control. every agent will get their own git users, committing their files by their names. There will be feature branches, pull and merge requests in the project.

There will be a tools registry, which the LLMs can use to perform tasks. For example, create file, or create many files, edit file or edit many files, etc, depending on each agent's tasks. Not all tools will be provided, but shown to the llm only when it has to perform an action, or a workflow.

There will also be modules registry for this project, which the agents will have access for docs, use cases, and choose them for completing their tasks. For example, zod for validations. These modules and libraries, though they are static, but the user can add more modules on demand.

There will be automatic linting, testing, AST trees generation, and prettifying taking place as the LLMs create the project. On lint errors, debug agents will be given context, and fix the code.

There will be a dynamic registry of files and functions for a project created or edited by this project, which will be given in context based on the workflow, which the LLM can use to map out different strategies for coding.

There will be many workflows for this project. A workflow for this project functions differently from others, in the sense that they can be combined into one or many workflows. The system prompts are the primary source defining the nature of a workflow, for example, if only using the business logic system prompt, the workflow will generate only business logic code, or both business logic and validations prompts can be combined to make the workflows generate validated code. There can also be use of different tools for each workflow. For example, either create one file at a time, or create entire feature files in one go. So the workflows are not fixed, but can be combined, or broken down to support the LLMs real capabilities.

To elaborate further on this use of workflows is that LLMs have different reasoning capabilities. For example, opus 5 can easily create entire features, while supporting business logic, security, performance, and validations at the same time. However smaller LLMs might only be able to create some or one file, or reason for single capability like business logic only at a time.

This project supports creating and editing Next.JS apps for now, but will support other frameworks and languages soon. However there will be tools to create configs, workflows, prompts, registry entries, etc, to support other frameworks and languages on demand.

For now this project will only be accessible using function calling, but soon there will be CLI, TUI, GUI, API, and SDK interfaces for more control, and integration.
