"use client";

import { useEffect, useState } from "react";

type EventRecord = {
    id: string;
    title: string;
    description?: string;
    location?: string;
    startDate: string;
    endDate: string;
    ticketPrice: number;
    currency: string;
    status: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString();
}

async function parseApiError(response: Response): Promise<string> {
    try {
        const payload = await response.json();
        if (typeof payload?.message === "string") return payload.message;
        if (Array.isArray(payload?.message)) return payload.message.join(", ");
    } catch {
        return `Failed with status ${response.status}`;
    }
    return `Failed with status ${response.status}`;
}

export default function EventsPage() {
    const [events, setEvents] = useState<EventRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadEvents = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(`${API_BASE_URL}/events?page=1&limit=24`, {
                    method: "GET",
                    headers: { "Content-Type": "application/json" },
                    cache: "no-store",
                });

                if (!response.ok) {
                    throw new Error(await parseApiError(response));
                }

                const payload = (await response.json()) as { data?: EventRecord[] };
                setEvents(payload.data ?? []);
            } catch (loadError) {
                setError(loadError instanceof Error ? loadError.message : "Could not load events");
            } finally {
                setIsLoading(false);
            }
        };

        void loadEvents();
    }, []);

    return (
        <main className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-indigo-950 px-4 pb-16 pt-28 text-white sm:px-8">
            <div className="mx-auto w-full max-w-6xl">
                <h1 className="mb-8 text-center text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 sm:text-5xl">
                    Upcoming Events
                </h1>

                {isLoading ? <p className="text-center text-sm text-gray-300">Loading events...</p> : null}
                {error ? <p className="rounded-xl bg-red-500/15 p-4 text-center text-sm text-red-200">{error}</p> : null}

                {!isLoading && !error && events.length === 0 ? (
                    <p className="text-center text-sm text-gray-300">No events available yet.</p>
                ) : null}

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {events.map((event) => (
                        <article
                            key={event.id}
                            className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition-all hover:bg-white/10"
                        >
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <h2 className="text-lg font-bold">{event.title}</h2>
                                <span className="rounded-full border border-blue-400/30 bg-blue-500/10 px-2 py-1 text-[11px] uppercase text-blue-200">
                                    {event.status}
                                </span>
                            </div>

                            <p className="mb-2 text-sm text-gray-300">{event.description || "No description available."}</p>
                            <p className="text-xs text-gray-400">Location: {event.location || "TBA"}</p>
                            <p className="text-xs text-gray-400">Starts: {formatDate(event.startDate)}</p>
                            <p className="text-xs text-gray-400">Ends: {formatDate(event.endDate)}</p>
                            <p className="mt-2 text-sm font-semibold text-indigo-200">
                                {event.ticketPrice} {event.currency}
                            </p>
                        </article>
                    ))}
                </div>
            </div>
        </main>
    );
}
