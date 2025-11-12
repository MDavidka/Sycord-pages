import clientPromise from "@/lib/mongodb"

export async function GET() {
  try {
    const client = await clientPromise
    const db = client.db("your_database_name")

    const tiers = await db.collection("subscriptionTiers").find({}).sort({ price: 1 }).toArray()

    // Default tiers if collection is empty
    if (tiers.length === 0) {
      const defaultTiers = [
        {
          name: "Free",
          price: 0,
          currency: "$",
          description: "Perfect for getting started",
          features: ["1 website", "Basic customization", "Community support"],
          isPopular: false,
        },
        {
          name: "Professional",
          price: 29,
          currency: "$",
          description: "For growing businesses",
          features: ["5 websites", "Advanced customization", "Email support", "Custom domain", "Analytics"],
          isPopular: true,
        },
        {
          name: "Ultra",
          price: 99,
          currency: "$",
          description: "For enterprises",
          features: [
            "Unlimited websites",
            "Full customization",
            "24/7 priority support",
            "Custom domain",
            "Advanced analytics",
            "API access",
            "Team collaboration",
          ],
          isPopular: false,
        },
      ]

      return Response.json(defaultTiers)
    }

    return Response.json(tiers)
  } catch (error) {
    console.error("[v0] Error fetching subscriptions:", error)
    return Response.json({ error: "Failed to fetch subscriptions" }, { status: 500 })
  }
}
