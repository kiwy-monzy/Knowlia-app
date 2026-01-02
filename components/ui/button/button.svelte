<script lang="ts" module>
    import { cn, type WithElementRef } from "$lib/utils.js";
    import type {
        HTMLAnchorAttributes,
        HTMLButtonAttributes,
    } from "svelte/elements";
    import { type VariantProps, tv } from "tailwind-variants";

    export const buttonVariants = tv({
        base: "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium outline-none transition-all focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 cursor-pointer",
        variants: {
            variant: {
                default:
                    "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
                destructive:
                    "bg-destructive shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60 text-white",
                outline:
                    "bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 border",
                secondary:
                    "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
                ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
                link: "text-primary underline-offset-4 hover:underline",
                sidebar:
                    "w-full text-left justify-start px-4 py-2 rounded-md hover:bg-gray-200 text-base",
                pixel: "bg-secondary text-black font-bold shadow-[inset_2px_2px_0px_rgba(255,255,255,0.3),inset_-2px_-2px_0px_rgba(0,0,0,0.3)]  active:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3)] active:transform active:translate-y-[1px] transition-all duration-75 rounded-none",
                pixeldestructive:
                    "bg-primary text-white font-bold shadow-[inset_2px_2px_0px_rgba(255,255,255,0.3),inset_-2px_-2px_0px_rgba(0,0,0,0.3)] hover:bg-primary/80 active:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3)] active:transform active:translate-y-[1px] transition-all duration-75 rounded-none",
            },
            size: {
                default: "h-9 px-4 py-2 has-[>svg]:px-3",
                sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
                lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
                icon: "size-8",
                none: "",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    });

    export type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];
    export type ButtonSize = VariantProps<typeof buttonVariants>["size"];

    export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
        WithElementRef<HTMLAnchorAttributes> & {
            variant?: ButtonVariant;
            size?: ButtonSize;
        };
</script>

<script lang="ts">
    let {
        class: className,
        variant = "default",
        size = "default",
        ref = $bindable(null),
        href = undefined,
        type = "button",
        disabled,
        children,
        ...restProps
    }: ButtonProps = $props();
</script>

{#if href}
    <a
        bind:this={ref}
        data-slot="button"
        class={cn(buttonVariants({ variant, size }), className)}
        href={disabled ? undefined : href}
        aria-disabled={disabled}
        role={disabled ? "link" : undefined}
        tabindex={disabled ? -1 : undefined}
        {...restProps}
    >
        {@render children?.()}
    </a>
{:else}
    <button
        bind:this={ref}
        data-slot="button"
        class={cn(buttonVariants({ variant, size }), className)}
        {type}
        {disabled}
        {...restProps}
    >
        {@render children?.()}
    </button>
{/if}
