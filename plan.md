1. **Create the Architect Route (`app/api/ai/architect/route.ts`)**:
   - Create a POST endpoint that takes `messages` and `cheatSheet`.
   - Uses a prompt to act as the "UI Architect", returning a "Style JSON" with components, props, and unique function names as placeholders for logic, using components defined in the `cheatSheet`.

2. **Create the Developer Route (`app/api/ai/developer/route.ts`)**:
   - Create a POST endpoint that takes `styleJson` and `componentsSource`.
   - Uses a prompt to act as the "Senior React Developer" to map placeholder functions from "Style JSON" into real TypeScript/React logic (`useState`, `useEffect`, etc.).
   - Returns a "Function JSON" detailing the `logicBlocks` (target IDs, types, events, and implementation code).

3. **Create the Orchestrator Route (`app/api/ai/orchestrator/route.ts`)**:
   - Create a POST endpoint that takes `styleJson`, `functionJson`, and `shadcnLibrary` (optional).
   - This endpoint takes the "Style JSON" and "Function JSON" and programmatically generates the final `.tsx` file without any AI models, using regular expressions and a template approach to generate the final string.

4. **Create the Admin Page (`app/dashboard/admin/page.tsx`)**:
   - Provide a UI for editing the "Cheat Sheet" that the Architect uses.
   - Allows users to save it locally for now (or via an API endpoint/database in a real app).

5. **Modify `components/ai-website-builder.tsx` to use the New Pipeline**:
   - Remove references to `/api/ai/generate-plan` and `/api/ai/generate-website` in favor of the new 3-step pipeline (`architect` -> `developer` -> `orchestrator`).
   - Specifically inside the submit handler, initiate the Architect call.
   - Then pass the Architect's output to the Developer.
   - Finally, pass both outputs to the Orchestrator to get the final `.tsx` content.
   - Update `generatedPages` state with the combined result.

6. **Pre Commit Steps**: Run `pre_commit_instructions` to test, verify, review, and reflect.
