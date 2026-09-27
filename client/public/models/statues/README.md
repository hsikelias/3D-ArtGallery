# Supplied statue assets

Copied from the user-provided Hacknite 2026 asset folder. Original source files
are unchanged; filenames in this directory are shortened for web loading.

| Web file | Original file |
| --- | --- |
| dog.obj | 13180_ConcreteDogStatue_v1_NEW.obj |
| statue.obj | 12329_Statue_v1_l3.obj |
| statue-diffuse.jpg | statue_diffuse.jpg |
| thinker.obj | 12335_The_Thinker_v3_l2.obj |
| thinker-diffuse.jpg | TheThinker_Diffuse.jpg |
| thinker-bump.jpg | TheThinker_Bump.jpg |

`src/scene/loadStatues.js` converts Z-up to Y-up, scales the models, preserves the
supplied textures, and places low plinths in front of the middle wall. Edit its
`statuePlacements` list to move/rotate each exhibit. The dog has no usable supplied
texture/MTL, so it uses a neutral concrete material. The supplied Charging Bull
directory contained no files and is not included. The duplicate Thinker STL-style
OBJ is not needed.

`/statues-preview.html` is a Vite development-only inspection page; the sculptures
also load in the normal gallery. A statue loading failure does not block entry.
No model geometry or existing Blender anchors are modified. Statue collisions
are not added by this decorative placement change.
