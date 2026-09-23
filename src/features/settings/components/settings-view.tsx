import { Database, Globe, Info, Palette } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatJalaliDate } from "@/utils/date";
import { MembersCard } from "@/features/members/components/members-card";
import type {
  DataSummary,
  DeploymentInfo,
} from "@/features/settings/server/settings-service";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg bg-muted px-4 py-3">
      <dt className="truncate text-caption text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-body font-medium break-words">{children}</dd>
    </div>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <span className="text-caption text-muted-foreground">{label}</span>
      <span className="tabular block text-h3 font-light">
        {value.toLocaleString("fa-IR")}
      </span>
    </div>
  );
}

/**
 * Settings (task 8.12).
 *
 * Read-only, and the alert at the top says why rather than leaving a reader
 * hunting for the switches. Everything a household might expect to change
 * here is either fixed by what Finora is, or already settable where it is
 * used — and a second place to set it would be a second place for it to
 * disagree.
 */
export function SettingsView({
  deployment,
  data,
}: {
  deployment: DeploymentInfo;
  data: DataSummary;
}) {
  return (
    <div className="space-y-6">
      <Alert variant="info">
        <Info />
        <AlertTitle>بیشتر تنظیمات در جای خودشان هستند</AlertTitle>
        <AlertDescription>
          پوسته روشن و تیره در نوار بالا و مالک هر رکورد روی خود آن تغییر می‌کند. اعضای
          خانوار را همین‌جا اضافه کنید؛ بقیه این صفحه پیکربندی ثابت این نصب و خلاصه
          داده‌های آن است.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card variant="featured" className="reveal gap-5">
          <CardHeader>
            <div className="space-y-1">
              <CardTitle>پیکربندی</CardTitle>
              <CardDescription>زبان، تقویم و واحد پولی این نصب</CardDescription>
            </div>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Globe className="size-5" />
            </span>
          </CardHeader>

          <dl className="grid grid-cols-2 gap-3">
            <Row label="زبان و قالب‌بندی">{deployment.locale}</Row>
            <Row label="جهت رابط">
              {deployment.direction === "rtl" ? "راست‌به‌چپ" : "چپ‌به‌راست"}
            </Row>
            <Row label="منطقه زمانی">{deployment.timeZone}</Row>
            <Row label="تقویم نمایش">شمسی (هجری خورشیدی)</Row>
            <Row label="ذخیره مبالغ">
              {/* Why this matters is rule G.2, and it is worth stating. */}
              ریال، به‌صورت عدد صحیح
            </Row>
            <Row label="نمایش مبالغ">تومان</Row>
            <Row label="هر تومان">
              <span className="tabular">{deployment.rialPerToman}</span> ریال
            </Row>
          </dl>
        </Card>

        <MembersCard />
      </div>

      <Card variant="featured" className="reveal gap-5">
        <CardHeader>
          <div className="space-y-1">
            <CardTitle>داده‌های این نصب</CardTitle>
            <CardDescription>
              آنچه پایگاه داده نگه می‌دارد — برای پشتیبان‌گیری و انتقال
            </CardDescription>
          </div>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Database className="size-5" />
          </span>
        </CardHeader>

        <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-4">
          <Count label="حساب‌ها" value={data.accounts} />
          <Count label="تراکنش‌ها" value={data.transactions} />
          {/*
            Categories are seeded and served by the API, but have no screen
            of their own — the roadmap's final structure does not list one.
            The count is here so a household can at least see what it has.
          */}
          <Count label="دسته‌بندی‌ها" value={data.categories} />
          <Count label="دارایی‌ها" value={data.assets} />
          <Count label="وام‌ها" value={data.loans} />
          <Count label="پرداخت‌های دوره‌ای" value={data.recurringPayments} />
          <Count label="بودجه‌ها" value={data.budgets} />
          <Count label="اهداف" value={data.goals} />
        </div>

        <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Row label="نخستین تراکنش">
            {data.firstTransaction
              ? formatJalaliDate(new Date(data.firstTransaction))
              : "—"}
          </Row>
          <Row label="آخرین تراکنش">
            {data.lastTransaction
              ? formatJalaliDate(new Date(data.lastTransaction))
              : "—"}
          </Row>
        </dl>

        <p className="text-caption text-muted-foreground">
          برای گرفتن خروجی CSV به صفحه گزارش‌ها بروید؛ برای پشتیبان کامل پایگاه داده،
          docs/OPERATIONS.md را ببینید. دسته‌بندی‌ها از طریق API مدیریت می‌شوند و صفحه
          مستقلی ندارند.
        </p>
      </Card>

      <Card variant="featured" className="reveal gap-5">
        <CardHeader>
          <div className="space-y-1">
            <CardTitle>ظاهر</CardTitle>
            <CardDescription>پوسته روشن، تیره یا هماهنگ با سیستم</CardDescription>
          </div>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Palette className="size-5" />
          </span>
        </CardHeader>

        <p className="text-body text-muted-foreground">
          کلید تغییر پوسته در نوار بالای صفحه است و انتخاب شما در همین مرورگر نگه داشته
          می‌شود.
        </p>
      </Card>
    </div>
  );
}
