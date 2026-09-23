import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  Lightbulb,
  Sparkles,
  UserPlus,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LogoMark } from "@/components/layout/logo-mark";
import { findNavItem, requireNavItem } from "@/config/navigation";
import {
  FEATURES,
  GETTING_STARTED,
  ROUTINE,
  TIPS,
  type GuideStep,
} from "@/features/guide/content";

const reveal = (index: number) => ({ "--i": index }) as React.CSSProperties;
const toPersian = (value: number) => value.toLocaleString("fa-IR");

/**
 * The guide (راهنما): what Finora does, the order to start in, and the
 * routine it is built around.
 *
 * Written for someone who has just cloned the project and opened an empty
 * app, so it leads with the steps, in the order each one makes the next
 * useful — people, then accounts, then transactions — and only then tours
 * the sections. Every link goes to the page where that step happens.
 */
export function GuideView() {
  return (
    <div className="space-y-12">
      <GuideHero />

      <section aria-labelledby="guide-start" className="space-y-5">
        <SectionTitle
          id="guide-start"
          icon={Sparkles}
          title="شروع کار در هفت قدم"
          description="به همین ترتیب جلو بروید؛ هر قدم قدم بعدی را مفیدتر می‌کند."
        />
        <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {GETTING_STARTED.map((step, index) => (
            <StepCard key={step.title} step={step} index={index} />
          ))}
        </ol>
      </section>

      <section aria-labelledby="guide-routine" className="space-y-5">
        <SectionTitle
          id="guide-routine"
          icon={CalendarClock}
          title="روال پیشنهادی"
          description="چند دقیقه در روز، چند دقیقه در ماه — بیشتر از این لازم نیست."
        />
        <ol className="grid gap-4 md:grid-cols-3">
          {ROUTINE.map((rhythm, index) => (
            <li key={rhythm.when} className="reveal" style={reveal(index)}>
              <Card variant="featured" className="h-full gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-highlight text-body font-semibold text-highlight-foreground">
                    {toPersian(index + 1)}
                  </span>
                  <h3 className="text-h3">{rhythm.when}</h3>
                </div>
                <ul className="flex flex-col gap-2 text-body text-muted-foreground">
                  {rhythm.items.map((item) => (
                    <li key={item} className="flex gap-2">
                      <Check
                        aria-hidden
                        className="mt-1 size-4 shrink-0 text-primary"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="guide-features" className="space-y-5">
        <SectionTitle
          id="guide-features"
          icon={LogoIcon}
          title="هر بخش برای چیست"
          description="روی هر کارت بزنید تا به همان بخش بروید."
        />
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {FEATURES.map((feature, index) => {
            const item = requireNavItem(feature.href);
            const Icon = item.icon;

            return (
              <li key={feature.href} className="reveal" style={reveal(index)}>
                <Link
                  href={item.href}
                  className={cn(
                    "hover-lift group flex h-full gap-4 rounded-xl p-5",
                    "border border-card-edge bg-card glass-edge dark:border-border",
                  )}
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-body-lg font-semibold">{item.label}</span>
                    <span className="text-body text-muted-foreground">
                      {feature.body}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="guide-tips" className="space-y-5">
        <SectionTitle id="guide-tips" icon={Lightbulb} title="نکته‌ها" />
        <Card variant="featured" className="reveal">
          <ul className="grid gap-3 md:grid-cols-2">
            {TIPS.map((tip) => (
              <li
                key={tip}
                className="flex gap-3 rounded-lg bg-muted px-4 py-3 text-body text-muted-foreground"
              >
                <Lightbulb
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-warning"
                />
                {tip}
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  );
}

function GuideHero() {
  return (
    <section
      aria-label="راهنمای Finora"
      className={cn(
        "hero-surface reveal relative isolate overflow-hidden rounded-2xl p-6 sm:p-10",
        "bg-(image:--gradient-brand) text-on-brand shadow-floating",
      )}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <span className="hero-orb hero-orb-1" />
        <span className="hero-orb hero-orb-2" />
        <span className="absolute inset-x-0 top-0 h-px bg-linear-to-l from-transparent via-on-brand/60 to-transparent" />
        <LogoMark className="absolute -end-10 -top-16 h-80 w-auto -rotate-12 text-on-brand/10" />
      </div>

      <div className="flex max-w-2xl flex-col gap-5">
        <span className="inline-flex h-9 w-fit items-center gap-2 rounded-full bg-on-brand/15 px-4 text-body font-medium">
          <Sparkles aria-hidden className="size-4" />
          خوش آمدید
        </span>
        <h2 className="text-h1 font-light tracking-tight sm:text-display">
          از صفر تا اولین گزارش
        </h2>
        <p className="text-body-lg text-on-brand/80">
          Finora پول خانه را یک‌جا نگه می‌دارد: حساب‌ها، تراکنش‌ها، وام و اقساط،
          دارایی‌ها، بودجه و هدف‌ها — به تومان، با تقویم شمسی. این صفحه می‌گوید از کجا
          شروع کنید و هر بخش به چه کاری می‌آید.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/accounts">
              اولین حساب را بسازید
              <ArrowLeft />
            </Link>
          </Button>
          <Button asChild size="lg" variant="glass" className="text-on-brand">
            <Link href="/settings#members">
              <UserPlus />
              اعضای خانوار
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function StepCard({ step, index }: { step: GuideStep; index: number }) {
  const Icon = findNavItem(step.href.split("#")[0]!)?.icon ?? Sparkles;

  return (
    <li className="reveal" style={reveal(index)}>
      <Card
        variant="featured"
        className="hover-lift relative h-full gap-4 overflow-hidden"
      >
        <span
          aria-hidden
          className="tabular pointer-events-none absolute -end-2 -top-6 text-hero leading-none font-extralight text-primary/10"
        >
          {toPersian(index + 1)}
        </span>
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Icon aria-hidden className="size-5" />
          </span>
          <span className="text-caption font-medium text-muted-foreground">
            قدم {toPersian(index + 1)}
          </span>
          {step.optional ? <Badge variant="neutral">اختیاری</Badge> : null}
        </div>
        <div className="space-y-2">
          <h3 className="text-h3">{step.title}</h3>
          <p className="text-body text-muted-foreground">{step.body}</p>
        </div>
        <div className="mt-auto">
          <Button asChild variant="secondary" size="sm">
            <Link href={step.href}>
              {step.action}
              <ArrowLeft />
            </Link>
          </Button>
        </div>
      </Card>
    </li>
  );
}

function SectionTitle({
  id,
  icon: Icon,
  title,
  description,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon aria-hidden className="size-5" />
      </span>
      <div className="space-y-1">
        <h2 id={id} className="text-h2">
          {title}
        </h2>
        {description ? (
          <p className="text-body text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

function LogoIcon({ className }: { className?: string }) {
  return <LogoMark className={cn(className, "h-5 w-auto")} />;
}
