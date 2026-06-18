import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { getClientIP } from "@/lib/get-client-ip"
import { containsCurseWords } from "@/lib/curse-word-filter"
import { generateWebpageId } from "@/lib/generate-webpage-id"
import { ObjectId } from "mongodb"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const client = await clientPromise
  const db = client.db()

  console.log("==========================================");
  console.log(`[Project Creation] Start for User: ${session.user.email}`);

  let body;
  try {
      body = await request.json();
  } catch (e) {
      return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  // Validate businessName
  if (!body.businessName || typeof body.businessName !== 'string' || body.businessName.trim().length === 0) {
      return NextResponse.json({ message: "Business name is required" }, { status: 400 });
  }
  if (body.businessName.length > 100) {
      return NextResponse.json({ message: "Business name is too long (max 100 chars)" }, { status: 400 });
  }

  // Validate description if present
  if (body.businessDescription && (typeof body.businessDescription !== 'string' || body.businessDescription.length > 1000)) {
       return NextResponse.json({ message: "Business description is invalid or too long" }, { status: 400 });
  }

  // Validate profileImage if present (data URL or http(s) URL). Cap size to protect DB docs.
  let safeProfileImage = "";
  if (body.profileImage !== undefined && body.profileImage !== null && body.profileImage !== "") {
      if (typeof body.profileImage !== 'string') {
          return NextResponse.json({ message: "profileImage must be a string" }, { status: 400 });
      }
      // A 2MB image encoded as base64 data URL is ~2.8MB; allow some headroom.
      if (body.profileImage.length > 3_500_000) {
          return NextResponse.json({ message: "profileImage is too large (max 2MB image)" }, { status: 400 });
      }
      const isDataUrl = /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(body.profileImage);
      const isHttpUrl = /^https?:\/\//i.test(body.profileImage);
      if (!isDataUrl && !isHttpUrl) {
          return NextResponse.json({ message: "profileImage must be an image data URL or http(s) URL" }, { status: 400 });
      }
      safeProfileImage = body.profileImage;
  }

  // Fetch user doc to check limits and existing projects
  const userDoc = await db.collection("users").findOne({ id: session.user.id })
  const userProjects = userDoc?.projects || []

  // @ts-ignore
  const isPremium = session.user.isPremium || false
  const MAX_FREE_WEBSITES = 3

  if (!isPremium && userProjects.length >= MAX_FREE_WEBSITES) {
    return NextResponse.json(
      {
        message: `Free users can only create up to ${MAX_FREE_WEBSITES} websites. Upgrade to premium for unlimited websites.`,
      },
      { status: 403 },
    )
  }

  const webpageId = generateWebpageId()

  // sanitize body fields to prevent injection of unexpected fields
  const safeBody = {
      businessName: body.businessName.trim(),
      businessDescription: (body.businessDescription || "").trim(),
      subdomain: body.subdomain,
      style: body.style,
      profileImage: safeProfileImage,
      // explicitly exclude fields that shouldn't be user-settable if any
  };

  const IDLE_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quantum Innovations</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 text-gray-900 font-sans min-h-screen flex flex-col">
    <!-- Navigation -->
    <header class="bg-white shadow-sm">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <div class="text-xl font-bold text-blue-600">Quantum Innovations</div>
            <nav class="hidden md:flex space-x-8 text-sm font-medium text-gray-700">
                <a href="#" class="hover:text-blue-600">Home</a>
                <a href="#" class="hover:text-blue-600">Services</a>
                <a href="#" class="hover:text-blue-600">About</a>
                <a href="#" class="hover:text-blue-600">Contact</a>
            </nav>
        </div>
    </header>

    <!-- Hero Section -->
    <main class="flex-grow flex flex-col justify-center">
        <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
            <h1 class="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight mb-6">
                Welcome to Quantum Innovations
            </h1>
            <p class="mt-4 max-w-2xl mx-auto text-xl text-gray-500 mb-10">
                Pioneering the future of technology with cutting-edge solutions designed to transform your business and elevate your success.
            </p>
            <div class="flex justify-center gap-4">
                <a href="#" class="px-8 py-3 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700 transition">Get Started</a>
                <a href="#" class="px-8 py-3 rounded-md bg-white border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition">Learn More</a>
            </div>
        </section>

        <!-- Features Grid -->
        <section class="bg-white py-16">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                    <div class="p-6 bg-gray-50 rounded-lg border border-gray-100 shadow-sm">
                        <div class="w-12 h-12 mx-auto bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mb-4">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                        </div>
                        <h3 class="text-xl font-bold mb-2">Advanced Analytics</h3>
                        <p class="text-gray-600">Unlock powerful insights with our next-generation data analytics platform.</p>
                    </div>
                    <div class="p-6 bg-gray-50 rounded-lg border border-gray-100 shadow-sm">
                        <div class="w-12 h-12 mx-auto bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mb-4">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"></path></svg>
                        </div>
                        <h3 class="text-xl font-bold mb-2">Cloud Architecture</h3>
                        <p class="text-gray-600">Scalable and secure cloud infrastructure tailored to your enterprise needs.</p>
                    </div>
                    <div class="p-6 bg-gray-50 rounded-lg border border-gray-100 shadow-sm">
                        <div class="w-12 h-12 mx-auto bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mb-4">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1m-1.636 6.364l-.707-.707M3 12h1m1.636-6.364l.707.707M12 21v-1m-4.636-6.364l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z"></path></svg>
                        </div>
                        <h3 class="text-xl font-bold mb-2">Machine Learning</h3>
                        <p class="text-gray-600">Intelligent AI solutions that learn and adapt to optimize your workflows.</p>
                    </div>
                </div>
            </div>
        </section>
    </main>

    <!-- Footer -->
    <footer class="bg-white py-8 border-t border-gray-200 text-center mt-auto">
        <p class="text-gray-500 text-sm">&copy; 2024 Quantum Innovations. All rights reserved.</p>
    </footer>
</body>
</html>`;

  let sanitizedSubdomain: string | null = null
  let deploymentData: any = null

  if (body.subdomain) {
    if (typeof body.subdomain !== 'string') {
        // just ignore invalid subdomain type
    } else {
        sanitizedSubdomain = body.subdomain
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9-]/g, "-")
          .replace(/^-+|-+$/g, "")

        if (sanitizedSubdomain.length >= 3 && !containsCurseWords(sanitizedSubdomain)) {
            deploymentData = {
              subdomain: sanitizedSubdomain,
              domain: `${sanitizedSubdomain}.pages.dev`,
              status: "active",
              createdAt: new Date(),
              updatedAt: new Date(),
              deploymentData: {
                businessName: safeBody.businessName,
                businessDescription: safeBody.businessDescription,
              },
            }
        }
    }
  }

  const projectId = new ObjectId()

  const newProject = {
    _id: projectId,
    ...safeBody,
    subdomain: sanitizedSubdomain, // Ensure subdomain is updated with sanitized version
    webpageId,
    userId: session.user.id, // Keep userId for reference, though embedded
    isPremium: isPremium,
    status: "active",
    createdAt: new Date(),
    pages: [
        {
            name: "index.html",
            content: IDLE_PAGE_HTML,
            usedFor: "Idle deployment placeholder",
            createdAt: new Date(),
            updatedAt: new Date()
        }
    ], // Initialize with idle page
    deployment: deploymentData, // Embed deployment info
    // Legacy fields for compatibility if needed, but we try to move away
    deploymentId: deploymentData ? new ObjectId() : null,
  }

  try {
    await db.collection("users").updateOne(
      { id: session.user.id },
      {
        $push: {
          projects: newProject
        } as any // TypeScript might complain about pushing to 'projects' if schema not defined
      }
    )

    console.log("[Project Creation] Project created successfully embedded in user:", projectId.toString())

    // Return the new project. We cast _id to string for JSON serialization compatibility if needed,
    // but Next.js usually handles ObjectId in JSON response or we should stringify it.
    // However, existing frontend likely expects _id to be present.
    return NextResponse.json(newProject, { status: 201 })
  } catch (error: any) {
    console.error("[v0] Error creating project:", error)
    return NextResponse.json(
      {
        message: "Failed to create project",
        error: error.message,
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const client = await clientPromise
  const db = client.db()

  try {
    const userDoc = await db.collection("users").findOne({ id: session.user.id })
    const projects = userDoc?.projects || []

    return NextResponse.json(projects)
  } catch (error: any) {
    console.error("Error fetching projects:", error)
    return NextResponse.json({ message: "Failed to fetch projects" }, { status: 500 })
  }
}
