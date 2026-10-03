---
status: accepted
date: 2026-10-03
amends: ADR-0003, ADR-0007
---

# A `media` module owns uploads; `feed` owns Link Previews on Posts

A new module, `media` (`packages/modules/media`, Postgres schema `media`), owns every uploaded image and the files made from it:
- uploads, from the pre-signed link to processing
- the sizes we serve
- the per-Member storage quota (1 GB, D56)
- the 24-hour cleanup of uploads never attached (D46)

It does this for Message images, Post images, Member avatars, Group Chat avatars and Link Preview images. The modules that own those items keep the reference: `chat.message_images.upload_id`, `feed.post_images.upload_id`, `identity.members.avatar_upload_id` and so on, by ID only.

- **Attaching.** A module saves its item and calls `media.attach(uploadId, kind, targetId)`. Processing ends with a `media.upload_processed` or `media.upload_rejected` job, which the owning module handles. For example, `chat` records the "images ready" Chat event (D46).
- **Serving.** The `/media/{id}/{size}` route in `apps/web` reads the upload from `media`, asks the module that owns the target whether the viewer may see it (`canView`, D9), then redirects to a signed or public link (D42). `media` never decides who may see an image.
- **Deleting.** When an item is Deleted, Removed or erased, its module asks `media` to delete the uploads. A Report snapshot can hold uploads, so they outlive that request until the snapshot is deleted (D58).

Link Previews stay with the item that shows them. `chat` owns Link Previews in Messages (`chat.link_previews`); `feed` owns Link Previews in Posts (`feed.link_previews`), one per Post for the first outside link. The fetching code, with its protection against requests to internal systems, is shared library code with no data, like the Reaction set in `packages/content`. It lives in its own package, because `packages/content` does no I/O; the package is named in the Link Preview ticket.

Tables and indexes: [data model](../architecture/data-model.md).

## Why

Uploads exist before the Message or Post they end up in (D46). The quota counts all of a Member's images, whichever module shows them. One cleanup job covers every kind. Split across `chat`, `feed` and `identity`, each module would repeat the upload flow, and every upload would add up usage from three modules before issuing a link.

Files are a context of their own: `media` knows about storage objects and sizes, not about Chats or Posts. That keeps ADR-0007's rule that a module owns data only for its own context. Access stays with the owning modules, so `canView` still has one home per item (D9).

D13 gives Posts Link Previews, and ADR-0007 gives Post data to `feed`. A Post's preview in `chat` would put feed data in another module. Two small tables of the same shape follow the same reasoning as the two Reaction implementations.

## Considered options

- **An `uploads` table in each of `chat`, `feed` and `identity`:** no new module, but three copies of the upload flow, processing hooks and cleanup, and the quota summed across modules on every upload.
- **`media` also decides access:** it would need to know Participants and Post visibility, which belong to `chat` and `feed`.
- **`chat` owns every Link Preview, including those in Posts:** `feed` would depend on `chat` for its own content, and Link Preview retention would follow Messages instead of Posts.

## Consequences

- The module list in spec §5.2, ADR-0003, ADR-0007, the architecture overview and `packages/modules/README.md` gains `media`. `chat`, `feed` and `identity` call it; it calls no module.
- `media` handles `member.erasure_requested`: it deletes the Member's uploads, except those a Report snapshot holds.
- The image processing jobs (`sharp`, D36) are registered by `media` in `apps/worker` (ADR-0008).
- The Link Preview fetcher package is created with the first Link Preview ticket (phase 2).
