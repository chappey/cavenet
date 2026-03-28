# Design System Document: Digital Primordialism

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Digital Monolith."** 

This system rejects the hyper-polished, "glass and glow" aesthetic of modern tech in favor of a flat, tactile, and grounded experience. It draws inspiration from ancient stone masonry and primitive survival. We are not building an "app"; we are chiseling a digital tool into sandstone. 

To move beyond a generic template, we utilize **intentional asymmetry** and **exaggerated radius scales**. Components should feel like hand-carved slabs. Layouts should eschew the standard 12-column grid in favor of "staggered stacking," where elements overlap slightly or sit off-axis to mimic the natural irregularity of a cave wall.

## 2. Colors & Surface Logic
The palette is restricted to a tactile, mineral-inspired range. We embrace the "Flat-Shaded" constraint by using color shifts rather than light effects to define hierarchy.

### The Palette (Tonal Stones)
*   **Background (`surface`):** `#fbf9f8` (Stone-200 equivalent) – The base "rock" layer.
*   **Surfaces (`surface_container`):** `#efedec` (Stone-100 equivalent) – Used for primary content slabs.
*   **Primary Action (`primary_container`):** `#f97316` – "Primitive Orange." This represents fire, heat, and urgency.
*   **Typography (`on_surface`):** `#1b1c1b` (Stone-900 equivalent) – Deep carbon for maximum readability.

### The "No-Gradient" Mandate
Strictly prohibit any linear, radial, or mesh gradients. Depth is achieved through flat color blocks. To create a sense of "carving," use a 1px border of `outline` (`#8c7164`) to simulate the edge of a chiseled stone.

### Surface Hierarchy
Instead of shadows, use the **Nesting Principle**:
1.  **Level 0 (Floor):** `surface` (`#fbf9f8`).
2.  **Level 1 (Slab):** `surface_container` (`#efedec`) with a `rounded-3xl` radius and 1px `stone-400` border.
3.  **Level 2 (Inlay):** `surface_container_high` (`#eae8e7`) for internal nested elements like input fields or secondary chips.

## 3. Typography: The Chiseled Word
We use **Space Grotesk** as the exclusive typeface. Its tabular spacing and geometric terminals evoke the feel of characters carved into a hard surface.

*   **Display (`display-lg`):** 3.5rem / Bold. Used for high-impact primitive statements. Negative letter-spacing of -0.02em to feel "compressed" like stone.
*   **Headline (`headline-md`):** 1.75rem / Medium. For section headers. Always Sentence case, never All-Caps (which feels too "shouty/modern").
*   **Body (`body-lg`):** 1rem / Regular. Set with generous line height (1.6) to provide breathing room against the heavy "stone" UI elements.
*   **Label (`label-md`):** 0.75rem / Bold. Used for functional data.

## 4. Elevation & Primitive Depth
Traditional shadows are forbidden. We define depth through **Tonal Layering** and **Physical Offsets**.

*   **The Layering Principle:** To make a card "pop," do not use a shadow. Instead, give it a thicker 2px border of `outline_variant` (`#e0c0b1`) or place it against a `surface_dim` background.
*   **The "Primitive Offset":** For high-priority elements, use a hard-shadow simulation. Place a solid block of `on_surface` color 4px below and to the right of the primary container to create a "brutalist" lift.
*   **No High-Tech Icons:** Icons must be primitive icons only. Use **Fire (Spark)** for inspiration/hot items and **Meat (Food/Cook)** for sustenance/resources. Avoid gears, bells, or signal bars.

## 5. Components

### Buttons (The Flint-Stones)
*   **Primary:** Background `primary_container` (#f97316), Text `on_primary` (#ffffff), `rounded-3xl`. No hover transition—use a hard "invert" or "border-thickening" state to signal interaction.
*   **Secondary:** Background `surface`, 1px `outline` border, Text `on_surface`.
*   **Tertiary:** Text only, bold, with a small Fire (Spark) icon.

### Input Fields (The Carved Trench)
*   Inputs should look "sunken." Use `surface_container_highest` (`#e4e2e1`) with a 1px `outline` border.
*   Radius must remain `rounded-3xl`. 
*   **Forbid Dividers:** In lists or forms, do not use lines. Use `1.4rem` (`spacing-4`) of vertical white space to separate thoughts.

### Chips (The Pebbles)
*   Small, `rounded-full` containers using `secondary_container`. Use these for tagging or categories. They should feel like smooth river stones.

### Cards & Lists
*   **The Slabs:** Every card must have a `rounded-3xl` (24px) corner radius. 
*   **The "No-Line" Rule:** Never use a horizontal rule `<hr>` to separate list items. Use a subtle background shift between `surface_container_low` and `surface_container_highest` to demarcate list rows.

## 6. Do’s and Don’ts

### Do:
*   **Do** use asymmetrical layouts. Push a heading to the far left and the body text to a narrow column on the right.
*   **Do** use the Meat icon for all "Content/Input" related actions and the Fire icon for "Submit/Execute" actions.
*   **Do** embrace "Heavy" weight. The UI should feel like it has physical mass.

### Don't:
*   **Don't** use animations that feel "airy" or "light." If an element moves, it should move instantly or with a heavy "thud" (stiff easing).
*   **Don't** use any icons representing modern technology (Wi-Fi, Cloud, Settings, Notifications).
*   **Don't** use transparency. All colors must be 100% opaque to maintain the "solid stone" aesthetic.
*   **Don't** use standard 8px rounding. Stick strictly to `rounded-3xl` for a distinctive, oversized "primitive" feel.