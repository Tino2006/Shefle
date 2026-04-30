import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const fileType = formData.get("fileType") as string; // 'logo', 'license', or 'passport'

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type based on what's being uploaded
    if (fileType === "license") {
      if (file.type !== "application/pdf") {
        return NextResponse.json(
          { error: "Business License must be a PDF file" },
          { status: 400 },
        );
      }
    } else if (fileType === "passport") {
      // Passport can be image or PDF
      const isImage = file.type.startsWith("image/");
      const isPDF = file.type === "application/pdf";

      if (!isImage && !isPDF) {
        return NextResponse.json(
          { error: "Passport must be an image (PNG, JPG, etc.) or PDF file" },
          { status: 400 },
        );
      }
    } else if (fileType === "logo") {
      // Logo can be image or PDF
      const isImage = file.type.startsWith("image/");
      const isPDF = file.type === "application/pdf";

      if (!isImage && !isPDF) {
        return NextResponse.json(
          { error: "Logo must be an image (PNG, JPG, etc.) or PDF file" },
          { status: 400 },
        );
      }
    } else if (
      fileType === "portfolio-certificate" ||
      fileType === "portfolio-logo"
    ) {
      const isImage = file.type.startsWith("image/");
      const isPDF = file.type === "application/pdf";

      if (!isImage && !isPDF) {
        return NextResponse.json(
          {
            error:
              "Portfolio certificate must be an image (PNG, JPG, WEBP, etc.) or PDF",
          },
          { status: 400 },
        );
      }
      if (file.size > 8 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Portfolio certificate must be under 8MB" },
          { status: 400 },
        );
      }
    }

    // Generate unique filename
    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/${fileType}-${Date.now()}.${fileExt}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from("brand-files")
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("brand-files").getPublicUrl(fileName);

    return NextResponse.json({
      message: "File uploaded successfully",
      fileUrl: publicUrl,
      fileName: data.path,
    });
  } catch (error) {
    console.error("Upload error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
