# Vendored schemas

Third-party files, copied here verbatim so `xsd-conformance.ts` can validate against the real
`ids.xsd` with no network access. Do not edit them — replace them from source.

| File | Source | Licence |
| --- | --- | --- |
| `ids.xsd` | `buildingSMART/IDS@development`, `Schema/ids.xsd`, version 1.0.0 | CC BY-ND 4.0, © buildingSMART International Ltd. |
| `xml.xsd` | <https://www.w3.org/2001/xml.xsd> | W3C Software and Document Notice and Licence |
| `XMLSchema.xsd` | <https://www.w3.org/2001/XMLSchema.xsd> | W3C Software and Document Notice and Licence |

`ids.xsd` imports the two W3C meta-schemas by absolute URL — it needs `XMLSchema.xsd` because an
IDS document embeds real `<xs:restriction>` elements, which the schema then validates as schema.
Nothing here has network access, so `xsd-conformance.ts` rewrites those two `schemaLocation`s to
point at the copies beside them, and drops the `XMLSchema-instance` import, which resolves to no
schema document at all. The rewrite happens at load time rather than in the file, so `ids.xsd` stays
byte-for-byte upstream and can be diffed against a new release.

`ifctester` vendors the same `ids.xsd` at `src/ifctester/ifctester/ids.xsd`; it differs from this
copy only in a documentation URL.
