<div align="center" dir="rtl">

<img src="src/app/icon.svg" alt="لوگوی Finora" width="84" height="84" />

# Finora

**مدیریت مالی شخصی و خانوادگی، فارسی و راست‌به‌چپ، با تقویم شمسی — روی سرور خودتان.**

[English](./README.md) · **فارسی**

<br />

<img src="docs/screenshots/dashboard-light.jpg" alt="داشبورد Finora در پوسته روشن" width="100%" />

</div>

---

<div dir="rtl">

## درباره پروژه

Finora پول خانه را یک‌جا نگه می‌دارد: کجاست، چطور جابه‌جا می‌شود و به کجا می‌رود.
برای خانواده‌های فارسی‌زبان ساخته شده، پس ترجمه یک برنامه خارجی نیست: از اول
راست‌به‌چپ طراحی شده، مبالغ به تومان‌اند و همه تاریخ‌ها شمسی.

روی سرور خودتان اجرا می‌شود: با یک `docker compose up` برنامه و پایگاه داده
PostgreSQL آن روی سیستم شما بالا می‌آیند و داده‌های مالی‌تان جای دیگری نمی‌رود.

هیچ اسمی از پیش در آن نیست. می‌توانید تنها از آن استفاده کنید، یا کسانی را که با
آن‌ها پول مشترک دارید (همسر، فرزند، پدر و مادر) با هر نامی که می‌خواهید اضافه کنید.
آن وقت هر رکورد یا مال یکی از آن‌هاست یا مال کل خانه.

## امکانات

| | |
| --- | --- |
| **داشبورد** | موجودی، درآمد و هزینه ماه، ارزش خالص، جریان نقدی و پرداخت‌های نزدیک در یک صفحه بنتو، با کارت موجودی سه‌بعدی. |
| **حساب‌ها و تراکنش‌ها** | حساب بانکی، کیف پول، پول نقد و صندوق سرمایه‌گذاری. موجودی همیشه از روی تراکنش‌ها محاسبه می‌شود، نه دستی. انتقال بین حساب‌های خودتان هیچ‌وقت خرج حساب نمی‌شود. |
| **وام‌ها** | جدول اقساط خودکار، مانده بدهی، اقساط معوق و پرداخت با یک کلیک. |
| **پرداخت‌های دوره‌ای** | اجاره، اشتراک‌ها و قبض‌ها؛ ماهانه، هفتگی، سالانه یا دلخواه. هر سررسید با پرداخت به تراکنش تبدیل می‌شود. |
| **بودجه‌ها** | سقف ماهانه برای هر دسته، برای خانه و برای هر نفر، با هشدار و انتقال مانده به ماه بعد. |
| **دارایی‌ها** | طلا، ارز، خودرو و سرمایه‌گذاری. تاریخچه قیمت نگه داشته می‌شود و قیمت امروز گذشته را بازنویسی نمی‌کند. |
| **اهداف** | هدف پس‌انداز با مهلت، مبلغ ماهانه لازم و واریزها. |
| **پیش‌بینی** | جریان نقدی ماه‌های آینده بر اساس درآمد، پرداخت‌های ثابت و بودجه‌ها، با هشدار کسری. |
| **تقویم** | همه سررسیدها روی تقویم ماهانه شمسی. |
| **گزارش‌ها** | درآمد، هزینه، بدهی، دارایی و ارزش خالص در هر بازه، با خروجی CSV. |
| **خانواده** | خرج مشترک و شخصی و سهم هر نفر در هزینه‌های خانه؛ فقط اطلاعاتی است، نه رقابتی. |
| **راهنما** | معرفی امکانات و نحوه شروع کار، داخل خود برنامه. |

به‌علاوه: پوسته روشن و تیره با انیمیشن دایره‌ای، پس‌زمینه متحرک، جداسازی سه‌رقمی
در همه فیلدهای مبلغ، و نسخه موبایل با داک شناور.

## تصاویر

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/dashboard-dark.jpg" alt="داشبورد در پوسته تیره" /></td>
    <td width="50%"><img src="docs/screenshots/accounts.jpg" alt="حساب‌ها" /></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/budgets.jpg" alt="بودجه‌ها در پوسته تیره" /></td>
    <td><img src="docs/screenshots/calendar.jpg" alt="تقویم مالی شمسی" /></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/reports.jpg" alt="گزارش‌ها" /></td>
    <td><img src="docs/screenshots/guide.jpg" alt="راهنمای برنامه" /></td>
  </tr>
</table>

<p align="center">
  <img src="docs/screenshots/mobile-dashboard.jpg" alt="داشبورد در موبایل" width="30%" />
  &nbsp;&nbsp;
  <img src="docs/screenshots/mobile-loans.jpg" alt="وام‌ها در موبایل، پوسته تیره" width="30%" />
</p>

## تکنولوژی‌ها

<p align="center">
  <img src="https://skillicons.dev/icons?i=nextjs,react,ts,tailwind,prisma,postgres,docker,threejs,vitest&perline=9" alt="Next.js, React, TypeScript, Tailwind CSS, Prisma, PostgreSQL, Docker, three.js, Vitest" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js_16-000000?logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/React_19-149ECA?logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/shadcn%2Fui-000000?logo=shadcnui&logoColor=white" alt="shadcn/ui" />
  <img src="https://img.shields.io/badge/Radix_UI-161618?logo=radixui&logoColor=white" alt="Radix UI" />
  <img src="https://img.shields.io/badge/Prisma_7-2D3748?logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Recharts-22B5BF?logo=chartdotjs&logoColor=white" alt="Recharts" />
  <img src="https://img.shields.io/badge/Motion-0055FF?logo=framer&logoColor=white" alt="Motion" />
  <img src="https://img.shields.io/badge/GSAP-88CE02?logo=greensock&logoColor=black" alt="GSAP" />
  <img src="https://img.shields.io/badge/three.js-000000?logo=threedotjs&logoColor=white" alt="three.js" />
  <img src="https://img.shields.io/badge/Zod-3E67B1?logo=zod&logoColor=white" alt="Zod" />
  <img src="https://img.shields.io/badge/React_Hook_Form-EC5990?logo=reacthookform&logoColor=white" alt="React Hook Form" />
  <img src="https://img.shields.io/badge/Lucide-F56565?logo=lucide&logoColor=white" alt="Lucide" />
  <img src="https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=white" alt="Vitest" />
  <img src="https://img.shields.io/badge/Playwright-2EAD33?logo=playwright&logoColor=white" alt="Playwright" />
  <img src="https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white" alt="Docker" />
</p>

| بخش | انتخاب |
| --- | --- |
| فریم‌ورک | Next.js (App Router)، React، TypeScript |
| استایل | Tailwind CSS v4 با توکن‌های CSS، و shadcn/ui روی Radix |
| داده | PostgreSQL با Prisma |
| نمودار | Recharts |
| انیمیشن و سه‌بعدی | Motion برای چیدمان، GSAP برای ورود داشبورد، View Transitions برای تغییر پوسته، three.js برای کارت موجودی |
| فرم | React Hook Form و Zod |
| فونت | دانا، میزبانی‌شده با `next/font/local` |
| تست | Vitest (واحد و یکپارچگی با پایگاه داده) و آزمون پذیرش با Playwright |
| اجرا | Docker Compose (برنامه و PostgreSQL) |

### نکته‌های فنی

- **مبلغ هیچ‌وقت اعشاری نیست.** هر مبلغ به‌صورت عدد صحیح ریال (`BigInt`) ذخیره و
  به تومان نمایش داده می‌شود. هیچ مبلغی از `number` جاوااسکریپت عبور نمی‌کند.
- **انتقال خرج نیست.** جابه‌جایی پول بین حساب‌های خودتان درآمد، هزینه یا ارزش
  خالص را تغییر نمی‌دهد. هم قیدهای `CHECK` پایگاه داده و هم API این را تضمین می‌کنند.
- **گذشته دست نمی‌خورد.** قیمت جدید دارایی، تغییر نام دسته یا ویرایش وام، آنچه قبلاً
  ثبت شده را بازنویسی نمی‌کند.
- **شمسی فقط در لایه نمایش.** تاریخ‌ها به UTC ذخیره می‌شوند و فقط در لایه نمایش به
  شمسی و از شمسی تبدیل می‌شوند.

## راه‌اندازی

پیش‌نیاز: Docker همراه با Compose.

</div>

```bash
git clone https://github.com/rezaabdollahi7/finora.git
cd finora
cp .env.example .env
docker compose up
```

<div dir="rtl">

آدرس <http://localhost:3000> را باز کنید و از نوار کناری به **راهنما** بروید.
قدم‌های اول آنجا توضیح داده شده‌اند: اگر خواستید اعضای خانوار را اضافه کنید،
حساب‌هایتان را بسازید و بعد تراکنش‌ها را ثبت کنید.

**بعد از هر `git pull`** هم فقط همین `docker compose up` لازم است. کانتینر در هر
بار اجرا وابستگی‌ها را هماهنگ می‌کند، کلاینت Prisma را می‌سازد، مایگریشن‌های
جدید را اعمال می‌کند و seed (که تکرارش بی‌ضرر است) را دوباره اجرا می‌کند. هیچ
داده‌ای پاک نمی‌شود.

### بدون Docker

پیش‌نیاز: Node.js 22 و PostgreSQL 17. مقدار `DATABASE_URL` را در `.env` تنظیم کنید.

</div>

```bash
npm install
npm run db:deploy   # اعمال مایگریشن‌ها
npm run db:seed     # دسته‌بندی‌های پیش‌فرض
npm run dev
```

<div dir="rtl">

## اسکریپت‌ها

| اسکریپت | کاربرد |
| --- | --- |
| `npm run dev` | سرور توسعه |
| `npm run build` | ساخت نسخه production |
| `npm run start` | اجرای نسخه ساخته‌شده |
| `npm run lint` | ESLint |
| `npm run typecheck` | بررسی TypeScript |
| `npm run format` | Prettier |
| `npm run test` | تست‌های واحد و یکپارچگی (به پایگاه داده نیاز دارد) |
| `npm run db:migrate` | ساخت مایگریشن از تغییرات schema |
| `npm run db:deploy` | اعمال مایگریشن‌های باقی‌مانده |
| `npm run db:seed` | دسته‌بندی‌های پیش‌فرض |
| `npm run acceptance` | آزمون پذیرش روی نسخه در حال اجرا |

## امنیت

**Finora صفحه ورود ندارد.** هر کسی که به پورت آن دسترسی داشته باشد، همه‌چیز را
می‌بیند و می‌تواند تغییر دهد. آن را در شبکه خانگی، پشت VPN یا پشت یک reverse
proxy دارای احراز هویت اجرا کنید، نه مستقیم روی اینترنت. جزئیات استقرار و
پشتیبان‌گیری در [`docs/OPERATIONS.md`](./docs/OPERATIONS.md) آمده است.

## رفع اشکال

**`port is already allocated`**: برنامه دیگری، معمولاً یک PostgreSQL محلی، از
پورت 5432 یا 3000 استفاده می‌کند. پورت‌ها را در `.env` عوض کنید (مثلاً
`POSTGRES_PORT=5433` و `APP_PORT=3001`).

**خطای `Can't resolve '@/generated/prisma/client'` یا `tsx: not found` در Docker**:
کانتینر را با `docker compose up --build --force-recreate` از نو بسازید. اگر
باز هم تکرار شد، `docker compose down -v` volumeهای قدیمی را پاک می‌کند، ولی
پایگاه داده را هم پاک می‌کند.

## مستندات

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md): تصمیم‌های فنی و ساختار پوشه‌ها
- [`docs/DESIGN_SYSTEM.md`](./docs/DESIGN_SYSTEM.md): زبان بصری و توکن‌ها
- [`docs/OPERATIONS.md`](./docs/OPERATIONS.md): اجرا، پشتیبان‌گیری، ممیزی‌ها
- [`SPRINTS.md`](./SPRINTS.md): نقشه راه پیاده‌سازی
- [`CLAUDE.md`](./CLAUDE.md): قواعد پروژه

</div>
