"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { ContactSubmission } from "@/lib/types/database";

export default function AdminContacts() {
  const router = useRouter();
  const [contacts, setContacts] = useState<ContactSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>("new");

  useEffect(() => {
    fetchContacts();
  }, [filter]);

  const fetchContacts = async () => {
    try {
      const response = await fetch(`/api/admin/contacts?status=${filter}`);
      if (!response.ok) {
        router.push("/login");
        return;
      }
      const data = await response.json();
      setContacts(data.contacts);
    } catch (error) {
      toast.error("Failed to load contacts");
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (contactId: string) => {
    try {
      const response = await fetch(`/api/admin/contacts/${contactId}/read`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to mark as read");

      fetchContacts();
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const markAsReplied = async (contactId: string) => {
    try {
      const response = await fetch(`/api/admin/contacts/${contactId}/replied`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to mark as replied");

      toast.success("Marked as replied");
      fetchContacts();
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const archiveContact = async (contactId: string) => {
    try {
      const response = await fetch(`/api/admin/contacts/${contactId}/archive`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to archive");

      toast.success("Contact archived");
      fetchContacts();
    } catch (error) {
      toast.error("Failed to archive");
    }
  };

  const unarchiveContact = async (contactId: string) => {
    try {
      const response = await fetch(`/api/admin/contacts/${contactId}/unarchive`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to unarchive");

      toast.success("Contact unarchived");
      fetchContacts();
    } catch (error) {
      toast.error("Failed to unarchive");
    }
  };

  const deleteContact = async (contactId: string) => {
    if (!confirm("Are you sure you want to delete this contact message? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/contacts/${contactId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete");

      toast.success("Contact deleted");
      fetchContacts();
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      new: "bg-blue-100 text-blue-800",
      read: "bg-gray-100 text-gray-800",
      replied: "bg-green-100 text-green-800",
      archived: "bg-gray-100 text-gray-600",
    };
    return styles[status as keyof typeof styles] || "bg-gray-100 text-gray-800";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-800"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Contact Messages</h2>
        <p className="text-gray-600">Review and respond to customer inquiries</p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-2">
        {["new", "read", "replied", "archived"].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              filter === status
                ? "bg-red-800 text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:border-red-200"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Contacts List */}
      {contacts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500">No {filter} messages</p>
        </div>
      ) : (
        <div className="space-y-4">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className={`bg-white rounded-xl border p-6 transition-all relative ${
                contact.status === "new"
                  ? "border-blue-200 shadow-sm"
                  : "border-gray-200 hover:shadow-md"
              }`}
              onClick={() => contact.status === "new" && markAsRead(contact.id)}
            >
              {/* Action Buttons - Fixed at top right */}
              <div className="absolute top-6 right-6 flex gap-2 items-center">
                {/* Delete Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteContact(contact.id);
                  }}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete message"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>

                {/* Unarchive Button - Only show for archived messages */}
                {contact.status === "archived" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      unarchiveContact(contact.id);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium whitespace-nowrap"
                  >
                    Unarchive
                  </button>
                )}

                {/* Mark Replied Button */}
                {contact.status !== "replied" && contact.status !== "archived" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      markAsReplied(contact.id);
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium whitespace-nowrap"
                  >
                    Mark Replied
                  </button>
                )}

                {/* Archive Button */}
                {contact.status !== "archived" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      archiveContact(contact.id);
                    }}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm font-medium whitespace-nowrap"
                  >
                    Archive
                  </button>
                )}
              </div>

              {/* Content - with padding to avoid button overlap */}
              <div className="pr-64 mb-4">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {contact.name}
                  </h3>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(contact.status)}`}
                  >
                    {contact.status}
                  </span>
                </div>

                <div className="flex gap-6 text-sm text-gray-600 mb-4">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {contact.email}
                  </div>
                  {contact.phone && (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {contact.phone}
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <p className="text-gray-700 whitespace-pre-wrap break-words">{contact.message}</p>
                </div>

                {contact.file_url && (
                  <a
                    href={contact.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    View Attachment
                  </a>
                )}
              </div>

              <div className="pt-4 border-t border-gray-100 text-xs text-gray-500">
                Received on {new Date(contact.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
