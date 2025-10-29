"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

export default function SiteSettingsPage() {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const id = pathname.split("/").pop();

  useEffect(() => {
    if (id) {
      fetch(`/api/projects/${id}`)
        .then((res) => res.json())
        .then((data) => {
          setProject(data);
          setLoading(false);
        });
    }
  }, [id]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!project) {
    return <div>Project not found.</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-foreground mb-2">
        {project.businessName} Settings
      </h1>
      {/* Settings form will go here */}
    </div>
  );
}
