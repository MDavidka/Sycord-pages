// Shared Vercel logic

const STARTER_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome</title>
    <style>
        body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f0f0f0; }
        .container { text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        h1 { color: #333; }
        p { color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Welcome to your new website!</h1>
        <p>This site is hosted on Vercel.</p>
    </div>
</body>
</html>
`

export async function deployToVercel(token: string, project: any, db: any) {
    const projectName = `site-${project.webpageId}`
    let vercelProjectId = project.vercelProjectId
    let vercelProjectName = project.vercelProjectName || projectName

    // 1. Create/Get Project
    if (!vercelProjectId) {
        const createRes = await fetch("https://api.vercel.com/v9/projects", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: projectName,
                framework: null
            })
        })

        if (!createRes.ok) {
            const createData = await createRes.json()
            if (createData.error?.code === 'project_already_exists') {
                console.warn("Project already exists on Vercel, reusing:", projectName)
                // Try to fetch existing project to get ID
                const getRes = await fetch(`https://api.vercel.com/v9/projects/${projectName}`, {
                    headers: { "Authorization": `Bearer ${token}` }
                })
                if (getRes.ok) {
                    const getData = await getRes.json()
                    vercelProjectId = getData.id
                    vercelProjectName = getData.name
                } else {
                     throw new Error("Project exists but could not be retrieved")
                }
            } else {
                throw new Error(createData.error?.message || "Failed to create Vercel project")
            }
        } else {
            const createData = await createRes.json()
            vercelProjectId = createData.id
            vercelProjectName = createData.name
        }

        // Save Vercel Project ID to DB
        await db.collection("projects").updateOne(
            { _id: project._id },
            { $set: { vercelProjectId, vercelProjectName } }
        )
    }

    // 2. Create Deployment
    const deployRes = await fetch("https://api.vercel.com/v13/deployments", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            name: vercelProjectName,
            project: vercelProjectId,
            files: [
                {
                    file: "index.html",
                    data: STARTER_HTML
                }
            ],
            target: "production"
        })
    })

    const deployData = await deployRes.json()

    if (!deployRes.ok) {
        throw new Error(deployData.error?.message || "Failed to create deployment")
    }

    // 3. Update Project Status
    await db.collection("projects").updateOne(
        { _id: project._id },
        {
            $set: {
                status: "active",
                vercelDeploymentId: deployData.id,
                vercelUrl: deployData.url,
                deployedAt: new Date()
            }
        }
    )

    return deployData
}
