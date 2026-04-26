<!-- Source of truth: .specify/ directory. Maintained via spec-kit conventions. -->
# Frontend Guidelines — Presentation-Domain-Data Layering

**Source**: [Modularizing React Applications with Established UI Patterns](https://martinfowler.com/articles/modularizing-react-apps.html) by Juntao Qiu

## Principle
React is a view library, not the architecture. The frontend follows four layers — **Views**, **Hooks**, **Domain Models**, **Data Access** — each with one responsibility. Mixing them produces fat components, scattered conditionals, and logic that can't be tested without a DOM.

## The Four Layers

### Layer 1: Views (React Components)
- Pure presentational functions: receive typed props, return JSX
- No `useState`, no `useEffect`, no `fetch` — those belong in hooks
- Extract sub-components when a component handles more than one visual concern
- Example pattern:
  ```tsx
  // GOOD: Pure presentational
  const MetricCard = ({ label, value, status }: MetricCardProps) => (
    <div className={cn("card", statusColor(status))}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );

  // BAD: Mixed concerns
  const MetricCard = ({ ticker }: { ticker: string }) => {
    const [data, setData] = useState(null);
    useEffect(() => { fetch(`/api/${ticker}`).then(...) }, []);
    return <div>...</div>;
  };
  ```

### Layer 2: Hooks (State Management)
- Manage state and lifecycle only
- Delegate computation to domain models
- Delegate data fetching to gateway/data-access functions
- One hook per concern (`usePaymentMethods`, `useRoundUp`, etc.)
- Example:
  ```tsx
  const useReportData = (ticker: string) => {
    const [report, setReport] = useState<ReportData | null>(null);
    useEffect(() => {
      fetchReport(ticker).then(setReport); // gateway function
    }, [ticker]);
    return { report };
  };
  ```

### Layer 3: Domain Models (Plain TypeScript)
- Plain TS classes/functions — NO React imports, NO hooks, NO JSX
- Encapsulate business logic, validation, formatting, computation
- Use polymorphism over conditionals (Strategy pattern for variants)
- Must be testable without any React testing utilities
- Live in `models/` or `lib/` directories
- Example:
  ```ts
  class RiskAssessment {
    constructor(private score: number) {}
    get level(): string {
      if (this.score <= 20) return "Low";
      if (this.score <= 40) return "Low-Moderate";
      if (this.score <= 60) return "Moderate";
      if (this.score <= 80) return "High";
      return "Very High";
    }
    get color(): string { return riskColors[this.level]; }
    get isSpeculative(): boolean { return this.score > 70; }
  }
  ```

### Layer 4: Data Access (Gateways / Anti-Corruption Layer)
- Functions that call external APIs and transform responses into domain types
- Act as Anti-Corruption Layer — external data shapes never leak into the app
- Transform at the boundary using Zod schemas
- Never called from components — only from hooks or server functions
- Example:
  ```ts
  // gateway
  const fetchReport = async (ticker: string): Promise<ReportData> => {
    const response = await fetch(`/api/report/${ticker}`);
    const raw = await response.json();
    return reportDataSchema.parse(raw); // Zod validation at boundary
  };
  ```

## Anti-Patterns to Avoid

### Shotgun Surgery
When the same conditional logic (e.g., country code checks, ticker-specific formatting) is scattered across multiple components and hooks. Fix: extract into a domain model with polymorphism.

### Fat Components
Components that fetch data, transform it, manage state, AND render. Fix: split into layers — hook for state, gateway for fetching, model for transforms, component for rendering.

### Logic Leaks
Business logic hiding in JSX (e.g., `defaultChecked={method.provider === "cash"}`). Fix: encapsulate in domain model (`method.isDefault`).

### Direct Fetch in Components
Using `fetch` or `useEffect` for data loading directly in components. Fix: use gateway functions called from hooks or Next.js server components.

## DarkScore-Specific Layer Map

| Layer | DarkScore Location | Examples |
|-------|-------------------|----------|
| Views | `apps/web/components/report/` | `TickerBar`, `RiskGauge`, `MetricCards` |
| Hooks | `apps/web/hooks/` | `useReportData` (if client-side needed) |
| Models | `@darkscore/scoring-engine`, `@darkscore/types` | `RiskScore`, `ComponentScore`, `Rating` |
| Gateways | `@darkscore/data-providers` | `YahooFinanceProvider`, `DataAggregator` |

Note: In DarkScore Phase 0, most data fetching happens server-side (Next.js server components), so Layer 4 maps to the `@darkscore/data-providers` package rather than client-side gateways. The principles still apply — server components call the aggregator, never raw `fetch`.

## Reference
- [Modularizing React Applications](https://martinfowler.com/articles/modularizing-react-apps.html) — Juntao Qiu, Martin Fowler (Feb 2023)
- [Presentation Domain Data Layering](https://martinfowler.com/bliki/PresentationDomainDataLayering.html) — Martin Fowler

