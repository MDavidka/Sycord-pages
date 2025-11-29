import { containsCurseWords } from "@/lib/curse-word-filter"

export async function activateLocalDeployment(project: any, db: any) {
  const subdomain = project.subdomain || project.pendingSubdomain

  if (!subdomain) {
      console.log("[v0] No subdomain to activate for project:", project._id)
      return null
  }

  const sanitizedSubdomain = subdomain
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/^-+|-+$/g, "")

  if (sanitizedSubdomain.length < 3 || containsCurseWords(sanitizedSubdomain)) {
      console.log("[v0] Subdomain rejected during activation:", sanitizedSubdomain)
      throw new Error("Invalid subdomain")
  }

  // Check if deployment already exists
  const existingDeployment = await db.collection("deployments").findOne({ projectId: project._id })
  if (existingDeployment) {
      console.log("[v0] Deployment already exists for project:", project._id)
      return existingDeployment
  }

  try {
    const deployment = {
      projectId: project._id,
      userId: project.userId,
      subdomain: sanitizedSubdomain,
      domain: `${sanitizedSubdomain}.ltpd.xyz`,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
      deploymentData: {
        businessName: project.businessName,
        businessDescription: project.businessDescription || "",
      },
    }

    const deploymentResult = await db.collection("deployments").insertOne(deployment)
    console.log("[v0] Deployment created:", deploymentResult.insertedId, "subdomain:", sanitizedSubdomain)

    await db.collection("projects").updateOne(
      { _id: project._id },
      {
        $set: {
          deploymentId: deploymentResult.insertedId,
          subdomain: sanitizedSubdomain,
          domain: `${sanitizedSubdomain}.ltpd.xyz`,
          deployedAt: new Date(),
          // Ensure we clear any pending flag if we used one, though explicit fields are fine
        },
      },
    )

    return deployment
  } catch (deploymentError: any) {
    console.error("[v0] Error creating deployment:", deploymentError.message)
    throw deploymentError
  }
}
