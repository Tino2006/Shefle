"use client";

import { useMemo, useState, useRef } from "react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

import { getCountryOptions } from "@/lib/countries";

export default function RegisterPage() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [registrationType, setRegistrationType] = useState<
    "individual" | "company"
  >("individual");
  const [logoFileName, setLogoFileName] = useState<string>("");
  const [licenseFileName, setLicenseFileName] = useState<string>("");
  const [passportFileName, setPassportFileName] = useState<string>("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [passportFile, setPassportFile] = useState<File | null>(null);
  const [isColored, setIsColored] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const countryOptions = useMemo(() => getCountryOptions(), []);

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

      if (!logoFile) {
        toast.error("Please upload your logo");
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
          isColored,
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
      setLogoFileName("");
      setLicenseFileName("");
      setPassportFileName("");
      setLogoFile(null);
      setLicenseFile(null);
      setPassportFile(null);
      setIsColored(false);
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
                {countryOptions.map(({ code, name }) => (
                  <option key={code} value={name}>
                    {name}
                  </option>
                ))}
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

            {/* Trademark color */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  checked={isColored}
                  className="w-4 h-4 text-red-800 focus:ring-red-800 focus:ring-2"
                  type="checkbox"
                  onChange={(e) => setIsColored(e.target.checked)}
                />
                <span className="text-sm font-medium text-gray-900">
                  Trademark is colored
                </span>
              </label>
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
    </div>
  );
}
