# UI Polish - Quick Visual Reference

## Color Palette
```css
Navy Primary:    #183b6d
Navy Dark:       #0d2545
Gold Accent:     #dba63f
White:           #ffffff
Off-White:       #fafbfc
Light Gray:      #f5f5f0
Text Dark:       #000000
Text Medium:     #575757
Text Light:      #9ea1a7
```

## Component States

### Messages
```
User Message:
- Gradient: from-[#183b6d] to-[#0d2545]
- Text: white
- Border: none
- Shadow: shadow-sm hover:shadow-md
- Corners: rounded-lg
- Animation: fade-in-up

Assistant Message:
- Background: bg-white
- Text: text-[#000000]
- Border: border-[#9ea1a7]/20
- Shadow: shadow-sm hover:shadow-md
- Corners: rounded-lg
- Timestamp: bottom with clock icon
- Animation: fade-in-up
```

### Input Field
```
Default:
- Background: bg-white
- Border: border-[#9ea1a7]/30
- Corners: rounded-lg
- Shadow: shadow-sm

Focus:
- Ring: ring-2 ring-[#dba63f]/50
- Border: border-[#dba63f]

Disabled:
- Opacity: opacity-50
- Cursor: cursor-not-allowed
```

### Send Button
```
Default:
- Gradient: from-[#183b6d] to-[#0d2545]
- Text: white
- Corners: rounded-lg
- Shadow: shadow-md

Hover:
- Gradient: from-[#0d2545] to-[#183b6d]
- Shadow: shadow-lg
- Scale: scale-105

Active:
- Scale: scale-95

Disabled:
- Opacity: opacity-40
```

### Loading Indicator
```
Spinner:
- Dual rings: navy (#183b6d) + gold (#dba63f)
- Size: w-16 h-16
- Background ring: opacity-20
- Spinning ring: border-t-transparent

Typing Dots:
- Colors: navy, gold, navy
- Size: w-2 h-2
- Animation: bounce with staggered delays
- Text: "Wells is thinking..." (hidden on mobile)
```

### Empty State Cards
```
Default:
- Background: bg-white
- Border: border-[#9ea1a7]/20
- Corners: rounded-sm

Hover:
- Border: border-[#dba63f]/50
- Shadow: shadow-lg
- Scale: scale-105
- Title color: text-[#dba63f]
- Transition: all duration-300
```

### Header
```
Background: bg-white/80 backdrop-blur-xl
Border: border-b border-[#dba63f]/10
Shadow: shadow-sm

Logo Container:
- Background: gradient from-[#183b6d]/10 to-[#dba63f]/10
- Shape: rounded-full
- Size: w-10 h-10

Error Indicator:
- Background: bg-red-50
- Border: border-red-200
- Icon: text-red-500
- Text: text-red-700
```

## Animations

### fade-in
```css
Duration: 0.5s
Easing: ease-out
From: opacity-0
To: opacity-1
```

### fade-in-up
```css
Duration: 0.4s
Easing: ease-out
From: opacity-0, translateY(10px)
To: opacity-1, translateY(0)
```

### bounce (loading dots)
```css
Delays: 0ms, 150ms, 300ms
Built-in: animate-bounce
```

### spin (loading ring)
```css
Built-in: animate-spin
Direction: clockwise
Speed: continuous
```

### scale transforms
```css
Hover: scale-105 (105%)
Active: scale-95 (95%)
Transition: all duration-300
```

## Responsive Breakpoints

### Mobile (< 640px)
```
Padding: px-4 py-3
Font: text-sm
Gaps: gap-2
Message width: max-w-[85%]
Hide labels: hidden
Show icons only
```

### Desktop (>= 640px)
```
Padding: sm:px-6 sm:py-4
Font: sm:text-base
Gaps: sm:gap-4
Message width: sm:max-w-[75%]
Show labels: sm:inline
Show text + icons
```

## Spacing System

```
Extra tight: gap-1.5 (6px)
Tight:       gap-2 (8px)
Normal:      gap-3 (12px)
Comfortable: gap-4 (16px)

Padding small:  px-4 py-3
Padding medium: px-6 py-4
Padding large:  px-8 py-6
```

## Shadow Hierarchy

```
None:    shadow-none
Subtle:  shadow-sm
Default: shadow-md
Elevated: shadow-lg
Dramatic: shadow-2xl

With color:
Gold glow: shadow-[#dba63f]/30
```

## Border Radius

```
Sharp:   rounded-sm (2px)
Soft:    rounded-lg (8px)
Round:   rounded-full (9999px)
```

## Opacity Levels

```
Invisible:  opacity-0
Subtle:     opacity-10 to opacity-30
Visible:    opacity-50 to opacity-70
Default:    opacity-100
```

## Typography

```
Headings:
- font-serif
- tracking-tight
- text-[#183b6d]

Body:
- font-sans (default)
- leading-relaxed
- text-[#000000] or text-[#575757]

Labels:
- text-xs or text-sm
- tracking-wide
- text-[#9ea1a7]

Buttons:
- font-medium
- tracking-wide
- uppercase (sometimes)
```

## Key Interactive States

### Hover Effects
```tsx
// Buttons
hover:shadow-lg
hover:scale-105
hover:from-[#0d2545]

// Cards
hover:border-[#dba63f]/50
hover:shadow-lg
hover:scale-105

// Links
hover:text-[#dba63f]
```

### Active Effects
```tsx
// Buttons
active:scale-95

// Input
focus:ring-2 focus:ring-[#dba63f]/50
focus:border-[#dba63f]
```

### Disabled Effects
```tsx
disabled:opacity-40
disabled:cursor-not-allowed
```

## Transition Timing

```
Fast:     duration-100 to duration-200
Normal:   duration-300
Slow:     duration-500
Very slow: duration-1000

Easing:
- ease-out (default)
- ease-in-out (smooth)
- linear (constant)
```

## Z-Index Layers

```
Background canvas: z-0
Content:          z-10
Header/Footer:    z-20
Modals/Overlays:  z-30
Tooltips:         z-40
```

## Accessibility Notes

```
Focus indicators: ring-2 with brand color
Disabled states: opacity + cursor change
Error messages: icon + text
Loading states: spinner + text label
Alt text: on all icons/images
Keyboard nav: Enter to send, Tab to navigate
```

## Performance Tips

```
✅ Use CSS animations (not JS)
✅ Use transform instead of position
✅ Use opacity transitions
✅ Backdrop-filter for blur
✅ Stagger animations with delays
✅ Limit animation to transform/opacity
✅ Use will-change sparingly
```

## Common Patterns

### Gradient Backgrounds
```tsx
bg-gradient-to-br from-[#183b6d] to-[#0d2545]
bg-gradient-to-br from-[#fafbfc] via-white to-[#f5f5f0]
```

### Backdrop Effects
```tsx
bg-white/80 backdrop-blur-xl
bg-white/90 backdrop-blur-xl
```

### Glow Effects
```tsx
// Container
<div className="relative">
  <div className="absolute inset-0">
    <div className="w-20 h-20 bg-gradient-to-br from-[#183b6d]/5 to-[#dba63f]/5 rounded-full blur-2xl" />
  </div>
  <svg className="relative z-10">...</svg>
</div>
```

### Staggered Animations
```tsx
{items.map((item, i) => (
  <div
    key={i}
    className="animate-fade-in-up"
    style={{ animationDelay: `${Math.min(i * 50, 500)}ms` }}
  >
    {item}
  </div>
))}
```

---

This reference provides quick access to all the visual design tokens and patterns used in the polished UI.
