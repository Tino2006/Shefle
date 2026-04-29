"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [registrationType, setRegistrationType] = useState<
    "individual" | "company"
  >("individual");
  const [poaFileName, setPoaFileName] = useState<string>("");
  const [logoFileName, setLogoFileName] = useState<string>("");
  const [licenseFileName, setLicenseFileName] = useState<string>("");
  const [passportFileName, setPassportFileName] = useState<string>("");
  const [poaFile, setPoaFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [passportFile, setPassportFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePoaFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPoaFileName(e.target.files[0].name);
      setPoaFile(e.target.files[0]);
    }
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setLogoFileName(e.target.files[0].name);
      setLogoFile(e.target.files[0]);
    }
  };

  const handleLicenseFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setLicenseFileName(e.target.files[0].name);
      setLicenseFile(e.target.files[0]);
    }
  };

  const handlePassportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPassportFileName(e.target.files[0].name);
      setPassportFile(e.target.files[0]);
    }
  };

  const uploadFile = async (file: File, fileType: string): Promise<string> => {
    const uploadFormData = new FormData();

    uploadFormData.append("file", file);
    uploadFormData.append("fileType", fileType);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: uploadFormData,
    });

    if (!response.ok) {
      const error = await response.json();

      throw new Error(error.error || `Failed to upload ${fileType}`);
    }

    const data = await response.json();

    return data.fileUrl;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);

      // Get form values
      const firstName = formData.get("firstName") as string;
      const lastName = formData.get("lastName") as string;
      const companyName = formData.get("companyName") as string;
      const email = formData.get("email") as string;
      const phone = formData.get("phone") as string;
      const country = formData.get("country") as string;
      const city = formData.get("city") as string;
      const streetAddress = formData.get("streetAddress") as string;
      const buildingNumber = formData.get("buildingNumber") as string;
      const registrationCountry = formData.get("registrationCountry") as string;
      const typeOfWork = formData.get("workType") as string;

      // Validate required fields
      if (!email || !phone || !country || !city || !registrationCountry) {
        toast.error("Please fill in all required fields");
        setIsSubmitting(false);

        return;
      }

      if (registrationType === "individual" && (!firstName || !lastName)) {
        toast.error("Please enter your first and last name");
        setIsSubmitting(false);

        return;
      }

      if (registrationType === "company" && !companyName) {
        toast.error("Please enter your company name");
        setIsSubmitting(false);

        return;
      }

      if (!poaFile || !logoFile) {
        toast.error("Please upload POA and Logo files");
        setIsSubmitting(false);

        return;
      }

      if (registrationType === "company" && !licenseFile) {
        toast.error("Please upload Business License");
        setIsSubmitting(false);

        return;
      }

      if (registrationType === "individual" && !passportFile) {
        toast.error("Please upload your passport");
        setIsSubmitting(false);

        return;
      }

      // Upload files
      toast.loading("Uploading files...");

      const poaFileUrl = await uploadFile(poaFile, "poa");
      const logoFileUrl = await uploadFile(logoFile, "logo");
      let businessLicenseUrl: string | undefined;
      let passportFileUrl: string | undefined;

      if (registrationType === "company" && licenseFile) {
        businessLicenseUrl = await uploadFile(licenseFile, "license");
      }

      if (registrationType === "individual" && passportFile) {
        passportFileUrl = await uploadFile(passportFile, "passport");
      }

      toast.dismiss();
      toast.loading("Submitting registration...");

      // Submit brand registration
      const response = await fetch("/api/brands", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          registrationType,
          name:
            registrationType === "individual"
              ? `${firstName} ${lastName}`
              : undefined,
          companyName: registrationType === "company" ? companyName : undefined,
          email,
          phone,
          country,
          city,
          streetAddress,
          buildingNumber,
          registrationCountry,
          typeOfWork,
          poaFileUrl,
          logoFileUrl,
          businessLicenseUrl,
          passportFileUrl,
        }),
      });

      const data = await response.json();

      toast.dismiss();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit registration");
      }

      toast.success(
        "Registration submitted successfully! We'll review your application soon.",
      );

      // Reset form
      formRef.current?.reset();
      setPoaFileName("");
      setLogoFileName("");
      setLicenseFileName("");
      setPassportFileName("");
      setPoaFile(null);
      setLogoFile(null);
      setLicenseFile(null);
      setPassportFile(null);
      setRegistrationType("individual");

      // Redirect to profile or success page after 2 seconds
      setTimeout(() => {
        router.push("/profile");
      }, 2000);
    } catch (error) {
      console.error("Registration error:", error);
      toast.dismiss();
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to submit registration. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="w-full bg-white border-b border-gray-200">
        <div className="mx-auto max-w-[1600px] px-4 lg:px-6 py-16 text-center">
          <h1 className="text-4xl lg:text-5xl font-bold text-red-900 mb-2">
            Register Your Brand
          </h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-[800px] px-4 lg:px-6 pt-12 pb-16">
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <form ref={formRef} className="space-y-6" onSubmit={handleSubmit}>
            {/* Registration Type */}
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  checked={registrationType === "individual"}
                  className="w-4 h-4 text-red-800 focus:ring-red-800 focus:ring-2"
                  name="registrationType"
                  type="radio"
                  value="individual"
                  onChange={() => setRegistrationType("individual")}
                />
                <span className="text-sm font-medium text-gray-900">
                  Individual
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  checked={registrationType === "company"}
                  className="w-4 h-4 text-red-800 focus:ring-red-800 focus:ring-2"
                  name="registrationType"
                  type="radio"
                  value="company"
                  onChange={() => setRegistrationType("company")}
                />
                <span className="text-sm font-medium text-gray-900">
                  Company
                </span>
              </label>
            </div>

            {/* First Name and Last Name (Individual) / Company Name (Company) */}
            {registrationType === "individual" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    className="block text-sm font-medium text-gray-900 mb-2"
                    htmlFor="firstName"
                  >
                    First Name *
                  </label>
                  <input
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 transition-all"
                    id="firstName"
                    name="firstName"
                    placeholder="Enter first name"
                    type="text"
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-gray-900 mb-2"
                    htmlFor="lastName"
                  >
                    Last Name *
                  </label>
                  <input
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 transition-all"
                    id="lastName"
                    name="lastName"
                    placeholder="Enter last name"
                    type="text"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label
                  className="block text-sm font-medium text-gray-900 mb-2"
                  htmlFor="companyName"
                >
                  Company Name *
                </label>
                <input
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 transition-all"
                  id="companyName"
                  name="companyName"
                  placeholder="Enter company name"
                  type="text"
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label
                className="block text-sm font-medium text-gray-900 mb-2"
                htmlFor="email"
              >
                Email *
              </label>
              <input
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 transition-all"
                id="email"
                name="email"
                placeholder="Enter email address"
                type="email"
              />
            </div>

            {/* Phone Number */}
            <div>
              <label
                className="block text-sm font-medium text-gray-900 mb-2"
                htmlFor="phone"
              >
                Phone Number *
              </label>
              <input
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 transition-all"
                id="phone"
                name="phone"
                placeholder="Phone number"
                type="tel"
              />
            </div>

            {/* Address Section */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Address
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 transition-all"
                  name="country"
                  placeholder="Country *"
                  type="text"
                />
                <input
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 transition-all"
                  name="city"
                  placeholder="City *"
                  type="text"
                />
                <input
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 transition-all"
                  name="streetAddress"
                  placeholder="Street"
                  type="text"
                />
                <input
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 transition-all"
                  name="buildingNumber"
                  placeholder="Building"
                  type="text"
                />
              </div>
            </div>

            {/* Choose the country for registration */}
            <div>
              <label
                className="block text-sm font-medium text-gray-900 mb-2"
                htmlFor="registrationCountry"
              >
                Choose the country for registration *
              </label>
              <select
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 transition-all"
                id="registrationCountry"
                name="registrationCountry"
              >
                <option value="">Country of registration</option>
                <option value="lebanon">Lebanon</option>
                <option value="uae">United Arab Emirates</option>
                <option value="saudi">Saudi Arabia</option>
                <option value="egypt">Egypt</option>
                <option value="jordan">Jordan</option>
              </select>
            </div>

            {/* Type of work */}
            <div>
              <label
                className="block text-sm font-medium text-gray-900 mb-2"
                htmlFor="workType"
              >
                Type of work
              </label>
              <input
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 transition-all"
                id="workType"
                name="workType"
                placeholder="What type of work do you do?"
                type="text"
              />
            </div>

            {/* Upload POA */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Upload POA (Power of Attorney){" "}
                <span className="text-red-600">*</span>
              </label>
              {poaFileName && (
                <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                  <svg
                    className="w-4 h-4 text-red-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      clipRule="evenodd"
                      d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                      fillRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm text-gray-700 flex-1">
                    PDF - {poaFileName}
                  </span>
                  <button
                    className="text-red-600 hover:text-red-800"
                    type="button"
                    onClick={() => {
                      setPoaFileName("");
                      setPoaFile(null);
                    }}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        clipRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        fillRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              )}
              <label className="cursor-pointer">
                <input
                  accept=".pdf"
                  className="hidden"
                  type="file"
                  onChange={handlePoaFileChange}
                />
                <span className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-800 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  </svg>
                  Select file
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-2">
                Maximum file size: 10MB, PDF only.
              </p>
            </div>

            {/* Upload Wordmark or Logo */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Upload Wordmark or Logo <span className="text-red-600">*</span>
              </label>
              {logoFileName && (
                <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                  <svg
                    className="w-4 h-4 text-red-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      clipRule="evenodd"
                      d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                      fillRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm text-gray-700 flex-1">
                    {logoFileName}
                  </span>
                  <button
                    className="text-red-600 hover:text-red-800"
                    type="button"
                    onClick={() => {
                      setLogoFileName("");
                      setLogoFile(null);
                    }}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        clipRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        fillRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              )}
              <label className="cursor-pointer">
                <input
                  accept="image/*,.pdf"
                  className="hidden"
                  type="file"
                  onChange={handleLogoFileChange}
                />
                <span className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-800 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  </svg>
                  Select file
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-2">
                Maximum file size: 10MB. Accepted formats: PNG, JPG, GIF, WebP,
                PDF
              </p>
            </div>

            {/* Upload Business License (Company only) */}
            {registrationType === "company" && (
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Upload Business License{" "}
                  <span className="text-red-600">*</span>
                </label>
                {licenseFileName && (
                  <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                    <svg
                      className="w-4 h-4 text-red-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        clipRule="evenodd"
                        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                        fillRule="evenodd"
                      />
                    </svg>
                    <span className="text-sm text-gray-700 flex-1">
                      PDF - {licenseFileName}
                    </span>
                    <button
                      className="text-red-600 hover:text-red-800"
                      type="button"
                      onClick={() => {
                        setLicenseFileName("");
                        setLicenseFile(null);
                      }}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          clipRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          fillRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                )}
                <label className="cursor-pointer">
                  <input
                    accept=".pdf"
                    className="hidden"
                    type="file"
                    onChange={handleLicenseFileChange}
                  />
                  <span className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-800 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                      />
                    </svg>
                    Select file
                  </span>
                </label>
                <p className="text-xs text-gray-500 mt-2">
                  Maximum file size: 10MB, PDF only.
                </p>
              </div>
            )}

            {/* Upload Passport (Individual only) */}
            {registrationType === "individual" && (
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Upload Passport <span className="text-red-600">*</span>
                </label>
                {passportFileName && (
                  <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                    <svg
                      className="w-4 h-4 text-red-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        clipRule="evenodd"
                        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                        fillRule="evenodd"
                      />
                    </svg>
                    <span className="text-sm text-gray-700 flex-1">
                      {passportFileName}
                    </span>
                    <button
                      className="text-red-600 hover:text-red-800"
                      type="button"
                      onClick={() => {
                        setPassportFileName("");
                        setPassportFile(null);
                      }}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          clipRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          fillRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                )}
                <label className="cursor-pointer">
                  <input
                    accept="image/*,.pdf"
                    className="hidden"
                    type="file"
                    onChange={handlePassportFileChange}
                  />
                  <span className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-800 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                      />
                    </svg>
                    Select file
                  </span>
                </label>
                <p className="text-xs text-gray-500 mt-2">
                  Maximum file size: 10MB. Accepted formats: PNG, JPG, GIF,
                  WebP, PDF
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              className="w-full py-3.5 text-white text-base font-semibold bg-red-800 rounded-lg hover:bg-red-900 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Submitting..." : "Submit Application"}
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-[1600px] px-4 lg:px-20 py-8">
          <div className="flex flex-col lg:flex-row items-start gap-32">
            {/* Left Side - Brand Info */}
            <div className="flex-shrink-0 max-w-sm">
              <div className="mb-4">
                <div className="relative w-44 h-14">
                  <Image
                    fill
                    alt="Shefle Logo"
                    className="object-contain object-left"
                    src="/Images/Shefle-Logo.png"
                  />
                </div>
              </div>
              <p className="text-sm text-gray-800 mb-5 leading-relaxed">
                Brand protection and intellectual property monitoring for
                businesses and creators worldwide.
              </p>

              {/* Social Icons */}
              <div className="flex items-center gap-4">
                <a
                  aria-label="Instagram"
                  className="text-red-800 hover:text-red-900 transition-colors"
                  href="https://instagram.com"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </a>
                <a
                  aria-label="Facebook"
                  className="text-red-800 hover:text-red-900 transition-colors"
                  href="https://facebook.com"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </a>
                <a
                  aria-label="X"
                  className="text-red-800 hover:text-red-900 transition-colors"
                  href="https://twitter.com"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                <a
                  aria-label="TikTok"
                  className="text-red-800 hover:text-red-900 transition-colors"
                  href="https://tiktok.com"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Right Side - Company Links */}
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-4">
                Company
              </h3>
              <ul className="space-y-2.5">
                <li>
                  <Link
                    className="text-sm text-gray-700 hover:text-red-800 transition-colors"
                    href="/"
                  >
                    Home
                  </Link>
                </li>
                <li>
                  <Link
                    className="text-sm text-gray-700 hover:text-red-800 transition-colors"
                    href="/monitor"
                  >
                    Monitor
                  </Link>
                </li>
                <li>
                  <Link
                    className="text-sm text-gray-700 hover:text-red-800 transition-colors"
                    href="/portfolio"
                  >
                    Portfolio
                  </Link>
                </li>
                <li>
                  <Link
                    className="text-sm text-gray-700 hover:text-red-800 transition-colors"
                    href="/register"
                  >
                    Register
                  </Link>
                </li>
                <li>
                  <Link
                    className="text-sm text-gray-700 hover:text-red-800 transition-colors"
                    href="/contact"
                  >
                    Contact Us
                  </Link>
                </li>
                <li>
                  <Link
                    className="text-sm text-gray-700 hover:text-red-800 transition-colors"
                    href="/subscriptions"
                  >
                    Subscription
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
