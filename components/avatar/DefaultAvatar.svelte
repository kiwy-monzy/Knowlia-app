<script lang="ts">
    import NotificationCircle from "$lib/components/avatar/NotificationCircle.svelte";
    import { onMount } from "svelte";

    const ImageAssets = {
        BASE: "/loyca/base.png",
        MOUTH_OPEN: "/loyca/open_beak.png",
        EYES: {
            NORMAL: "/loyca/normal_eyes.png",
            HALF: "/loyca/half-open_eyes.png",
            CLOSED: "/loyca/closed_eyes.png",
            TIRED: "/loyca/tired_eyes.png",
            WIDE: "/loyca/wide-open_eyes.png",
            HAPPY: "/loyca/happy_eyes.png",
        },
        EFFECTS: {
            EXCLAMATION: "/loyca/exclamation.png",
            INTERROGATION: "/loyca/interrogation.png",
            SPARK: "/loyca/spark.png",
            SLEEPY: "/loyca/sleepy.png",
        },
    };

    const TIRED_AFTER_MS = 120000;

    let {
        isStreaming,
        isCallingModel,
        isFocused,
        isThinking,
        notification,
        handleNotification,
    } = $props<{
        isStreaming: boolean;
        isCallingModel: boolean;
        isFocused: boolean;
        isThinking: boolean;
        notification: { id: string; fromTest: boolean } | null;
        handleNotification: (action: string) => void;
    }>();

    type AvatarState =
        | "IDLE"
        | "FOCUSED"
        | "THINKING"
        | "LOADING"
        | "TALKING"
        | "NOTIFIED"
        | "HAPPY"
        | "ALMOST_SLEEPY"
        | "SLEEPY";
    let avatarState = $state<AvatarState>("IDLE");

    let baseEyesURL = $state(ImageAssets.EYES.NORMAL);
    let actualEyesURL = $state(ImageAssets.EYES.NORMAL);
    let actualAvatarURL = $state(ImageAssets.BASE);
    let effectURL = $state<string | null>(null);
    let effectClass = $state("");
    let avatarEffectClass = $state("");

    let isBlinking = false;
    let isTalking = false;
    let isMarkAnimating = false;
    let timers: ReturnType<typeof setTimeout>[] = [];

    const sleep = (ms: number) =>
        new Promise((resolve) => {
            const timer = setTimeout(resolve, ms);
            timers.push(timer);
        });

    $effect(() => {
        let sleepyTimer: ReturnType<typeof setTimeout>;
        let almostSleepyTimer: ReturnType<typeof setTimeout>;

        if (notification) avatarState = "NOTIFIED";
        else if (isThinking) avatarState = "THINKING";
        else if (isStreaming) avatarState = "TALKING";
        else if (isCallingModel) avatarState = "LOADING";
        else if (isFocused) avatarState = "FOCUSED";
        else {
            avatarState = "IDLE";
            sleepyTimer = setTimeout(() => {
                avatarState = "SLEEPY";
            }, TIRED_AFTER_MS);
            almostSleepyTimer = setTimeout(
                () => {
                    avatarState = "ALMOST_SLEEPY";
                },
                (TIRED_AFTER_MS * 3) / 4,
            );
        }

        return () => {
            clearTimeout(sleepyTimer);
            clearTimeout(almostSleepyTimer);
        };
    });

    $effect(() => {
        isTalking = false;
        isMarkAnimating = false;
        effectURL = null;
        effectClass = "";
        avatarEffectClass = "";
        actualAvatarURL = ImageAssets.BASE;

        switch (avatarState) {
            case "IDLE":
                baseEyesURL = ImageAssets.EYES.NORMAL;
                break;
            case "HAPPY":
                baseEyesURL = ImageAssets.EYES.HAPPY;
                actualAvatarURL = ImageAssets.MOUTH_OPEN;
                effectURL = ImageAssets.EFFECTS.SPARK;
                effectClass = "custom-animate-expand";
                break;
            case "FOCUSED":
                baseEyesURL = ImageAssets.EYES.NORMAL;
                break;
            case "LOADING":
                baseEyesURL = ImageAssets.EYES.HALF;
                effectURL = ImageAssets.EFFECTS.EXCLAMATION;
                effectClass = "custom-animate-expand";
                break;
            case "THINKING":
                baseEyesURL = ImageAssets.EYES.HALF;
                effectURL = ImageAssets.EFFECTS.INTERROGATION;
                effectClass = "custom-animate-expand";
                break;
            case "TALKING":
                baseEyesURL = ImageAssets.EYES.NORMAL;
                isTalking = true;
                talk();
                break;
            case "NOTIFIED":
                baseEyesURL = ImageAssets.EYES.WIDE;
                effectURL = ImageAssets.EFFECTS.EXCLAMATION;
                avatarEffectClass = "custom-animate-bounce";
                isMarkAnimating = true;
                animateMark();
                break;
            case "ALMOST_SLEEPY":
                baseEyesURL = ImageAssets.EYES.HALF;
                break;
            case "SLEEPY":
                baseEyesURL = ImageAssets.EYES.TIRED;
                effectURL = ImageAssets.EFFECTS.SLEEPY;
                effectClass = "custom-animate-ping";
                break;
        }
    });

    async function blinkLoop() {
        isBlinking = true;
        while (isBlinking) {
            const randomDelay = Math.random() * 5000 + 2000;
            await sleep(randomDelay);

            if (avatarState !== "SLEEPY") {
                actualEyesURL = ImageAssets.EYES.HALF;
                await sleep(100);
                actualEyesURL = ImageAssets.EYES.CLOSED;
                await sleep(100);
                actualEyesURL = ImageAssets.EYES.HALF;
                await sleep(100);
                actualEyesURL = baseEyesURL;
            } else {
                actualEyesURL = ImageAssets.EYES.CLOSED;
                const randomDelay = Math.random() * 1000 + 2000;
                await sleep(randomDelay);
                actualEyesURL = baseEyesURL;
            }
        }
    }

    $effect(() => {
        actualEyesURL = baseEyesURL;
    });

    async function talk() {
        if (!isTalking) return;
        actualAvatarURL = ImageAssets.MOUTH_OPEN;
        await sleep(150);
        actualAvatarURL = ImageAssets.BASE;
        await sleep(Math.random() * 100 + 150);
        requestAnimationFrame(() => talk());
    }

    async function animateMark() {
        if (!isMarkAnimating) {
            effectClass = "";
            return;
        }
        effectClass = "rotate-6";
        await sleep(500);
        effectClass = "-rotate-6";
        await sleep(500);
        requestAnimationFrame(() => animateMark());
    }

    onMount(() => {
        blinkLoop();

        return () => {
            isBlinking = false;
            timers.forEach(clearTimeout);
        };
    });
</script>

<div>
    <div class={`relative ${avatarEffectClass}`} data-tauri-drag-region>
        {#if effectURL}
            <img
                src={effectURL}
                class={`absolute pointer-events-none ${effectClass}`}
                alt=""
            />
        {/if}
        <div data-tauri-drag-region>
            <img
                src={actualEyesURL}
                class="absolute pointer-events-none"
                alt=""
            />
            <img
                src={actualAvatarURL}
                alt="AI Assistant Avatar"
                class="pointer-events-none z-2"
            />
        </div>
    </div>
    <NotificationCircle {notification} {handleNotification} />
</div>

<style>
    .custom-animate-bounce {
        animation: bounce 1s infinite;
    }
    @keyframes bounce {
        0%,
        20%,
        50%,
        80%,
        100% {
            transform: translateY(0);
        }
        40% {
            transform: translateY(-10px);
        }
        60% {
            transform: translateY(-5px);
        }
    }
    .custom-animate-ping {
        animation: ping 3s infinite;
    }
    @keyframes ping {
        0% {
            transform: scale(0.9);
        }
        75% {
            transform: scale(1);
        }
        100% {
            transform: scale(0.9);
        }
    }
    .custom-animate-expand {
        animation: expand 3s infinite;
    }
    @keyframes expand {
        0% {
            transform: scale(0.95);
        }
        50% {
            transform: scale(1);
        }
        100% {
            transform: scale(0.95);
        }
    }
</style>
