import type { Metadata } from "next";
import { z } from "zod";

import { PageHeader } from "@/components/common/page-header";
import { requireNavItem } from "@/config/navigation";
import { FORECAST_PERIODS } from "@/features/forecast/forecast";
import { getForecast } from "@/features/forecast/server/forecast-service";
import { ForecastView } from "@/features/forecast/components/forecast-view";

const nav = requireNavItem("/forecast");

export const metadata: Metadata = { title: nav.label };

/** Reads the database on every request; see docs/ARCHITECTURE.md. */
export const dynamic = "force-dynamic";

/** Only the four horizons the roadmap asks for; anything else falls back. */
const periodSchema = z
  .preprocess((value) => (value === undefined ? 3 : Number(value)), z.number().int())
  .catch(3)
  .transform((value) =>
    (FORECAST_PERIODS as readonly number[]).includes(value)
      ? (value as (typeof FORECAST_PERIODS)[number])
      : 3,
  );

type Props = { searchParams: Promise<{ period?: string }> };

export default async function ForecastPage({ searchParams }: Props) {
  const { period } = await searchParams;
  const forecast = await getForecast(periodSchema.parse(period), new Date());

  return (
    <div className="space-y-8">
      <PageHeader title={nav.label} description={nav.description} />
      <ForecastView forecast={forecast} />
    </div>
  );
}
