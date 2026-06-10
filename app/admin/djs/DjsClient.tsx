"use client";

import { useEffect, useState } from "react";
import MediaPicker from "@/components/admin/MediaPicker";
import {
  loadAllDjs,
  createDj,
  updateDj,
  deleteDj,
  type DbDj,
} from "@/lib/db/djs";

// =============================================================
// /admin/djs — DJ profile manager
// =============================================================
// CRUD for the `djs` table. Each DJ has:
//   • name (required)
//   • bio (optional, internal)
//   • profile_image_url (uploaded via the shared MediaPicker)
//   • instagram_handle (optional, reserved for future public page)
//
// The profile image is the FALLBACK for any event linked to this DJ
// that doesn't have a per-event poster of its own. See
// resolveEventImage() in lib/db/djs.ts.
// =============================================================

export default function DjsClient() {
  const [djs, setDjs] = useState<DbDj[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Edit modal state
  const [editing, setEditing] = useState<DbDj | null>(null);
  const [creating, setCreating] = useState(false);

  async function reload() {
    setLoading(true);
    setErr("");
    try {
      setDjs(await loadAllDjs());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't load DJs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleDelete(dj: DbDj) {
    if (
      !confirm(
        `Delete "${dj.name}"? Events linked to this DJ stay (their dj_id is cleared) but the fallback image goes away.`,
      )
    )
      return;
    try {
      await deleteDj(dj.id);
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Couldn't delete");
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 text-cream">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-wider">
            DJs
          </h1>
          <p className="mt-1 text-sm text-cream/65">
            Profiles for recurring / resident DJs. The profile image is
            the fallback artwork for any event linked to this DJ that
            doesn't have its own poster uploaded.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-full bg-plonkPink px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-plonkPink/90"
        >
          + Add DJ
        </button>
      </header>

      {err && (
        <div className="mb-6 rounded-lg border border-plonkPink/40 bg-plonkPink/10 px-4 py-3 text-sm text-plonkPink">
          {err}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-cream/55">Loading…</p>
      ) : djs.length === 0 ? (
        <p className="text-sm text-cream/55">
          No DJs yet. Click <span className="text-plonkPink">+ Add DJ</span>{" "}
          to add one — once a DJ exists you can link it to a{" "}
          <span className="text-plonkTeal">dj_night</span> event in{" "}
          /admin/events.
        </p>
      ) : (
        <ul className="space-y-3">
          {djs.map((dj) => (
            <li
              key={dj.id}
              className="flex items-center gap-4 rounded-xl border border-cream/10 bg-ink/40 p-4"
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-ink/60">
                {dj.profile_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={dj.profile_image_url}
                    alt={dj.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[9px] uppercase tracking-widest text-cream/40">
                    No image
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-lg uppercase tracking-wider text-cream">
                  {dj.name}
                </div>
                {dj.bio && (
                  <p className="mt-1 line-clamp-2 text-xs text-cream/60">
                    {dj.bio}
                  </p>
                )}
                {dj.instagram_handle && (
                  <p className="mt-1 text-[11px] uppercase tracking-widest text-plonkTeal">
                    @{dj.instagram_handle}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(dj)}
                  className="rounded-full border border-cream/20 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-cream/85 transition hover:border-cream/45"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(dj)}
                  className="rounded-full border border-plonkPink/40 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-plonkPink/85 transition hover:border-plonkPink"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {(editing || creating) && (
        <DjModal
          dj={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={async () => {
            setEditing(null);
            setCreating(false);
            await reload();
          }}
        />
      )}
    </main>
  );
}

// ----- Create / edit modal -----
function DjModal({
  dj,
  onClose,
  onSaved,
}: {
  dj: DbDj | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState(dj?.name ?? "");
  const [bio, setBio] = useState(dj?.bio ?? "");
  const [profileImageUrl, setProfileImageUrl] = useState(
    dj?.profile_image_url ?? "",
  );
  const [instagram, setInstagram] = useState(dj?.instagram_handle ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [picking, setPicking] = useState(false);

  async function save() {
    setBusy(true);
    setErr("");
    try {
      if (dj) {
        await updateDj(dj.id, {
          name,
          bio,
          profile_image_url: profileImageUrl,
          instagram_handle: instagram,
        });
      } else {
        await createDj({
          name,
          bio,
          profile_image_url: profileImageUrl,
          instagram_handle: instagram,
        });
      }
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-cream/15 bg-ink p-6">
        <h2 className="font-display text-2xl uppercase tracking-wider text-cream">
          {dj ? "Edit DJ" : "Add DJ"}
        </h2>

        <div className="mt-6 space-y-4 text-sm">
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-cream/65">
              Name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-cream/65">
              Profile image
            </span>
            <div className="flex items-center gap-3">
              <div className="h-20 w-20 overflow-hidden rounded-lg bg-ink/60">
                {profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profileImageUrl}
                    alt="DJ profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[9px] uppercase tracking-widest text-cream/40">
                    None
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setPicking(true)}
                  className="rounded-full border border-cream/25 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-cream/85 transition hover:border-cream/55"
                >
                  {profileImageUrl ? "Change" : "Pick / upload"}
                </button>
                {profileImageUrl && (
                  <button
                    type="button"
                    onClick={() => setProfileImageUrl("")}
                    className="text-[11px] uppercase tracking-widest text-plonkPink/85"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
            <p className="mt-2 text-[11px] text-cream/45">
              Used as the fallback artwork for any event linked to this
              DJ when no per-event poster is uploaded.
            </p>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-cream/65">
              Bio (internal — admin only at launch)
            </span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className={inputCls}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-cream/65">
              Instagram handle (optional, without @)
            </span>
            <input
              type="text"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="nodice.bar"
              className={inputCls}
            />
          </label>

          {err && (
            <div className="rounded-lg border border-plonkPink/40 bg-plonkPink/10 px-3 py-2 text-xs text-plonkPink">
              {err}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full border border-cream/20 px-5 py-2 text-xs font-bold uppercase tracking-widest text-cream/85 transition hover:border-cream/45 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy || !name.trim()}
            className="rounded-full bg-plonkPink px-5 py-2 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-plonkPink/90 disabled:opacity-40"
          >
            {busy ? "Saving…" : dj ? "Save" : "Add DJ"}
          </button>
        </div>
      </div>

      {picking && (
        <MediaPicker
          onPick={(val) => {
            // MediaPicker may return a positioner object or a plain URL.
            const url = typeof val === "string" ? val : val.url;
            setProfileImageUrl(url);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
          aspect="1/1"
          initial={
            profileImageUrl ? { url: profileImageUrl } : undefined
          }
        />
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none";
