import { Bash, InMemoryFs } from "just-bash";
import { createReportPlugin } from "./dist/index.js";
import { writeFileSync, mkdirSync } from "fs";

const BRAND_MD = `---
colors:
  primary: "#0f172a"
  secondary: "#6366f1"
  accent: "#6366f1"
  success: "#059669"
  danger: "#dc2626"
  background: "#f8fafc"
  card: "#ffffff"
  text: "#0f172a"
  muted: "#64748b"

typography:
  heading:
    fontFamily: "Playfair Display, serif"
  body:
    fontFamily: "Inter, sans-serif"

logo: "https://img.logoipsum.com/297.svg"
---
`;

const bash = new Bash({
  fs: new InMemoryFs({ "/brand/BRAND.md": BRAND_MD }),
  customCommands: createReportPlugin({ rootDir: "/data" }),
});

const run = async (cmd) => {
  const r = await bash.exec(cmd);
  if (r.exitCode !== 0) console.log(`  ERR: ${r.stderr.trim()}`);
  return r;
};

async function main() {
  console.log("=== Static Blog Generator Test ===\n");

  // 1. Agent creates blog posts using content template pattern
  console.log("1. Agent writes blog posts...\n");

  const posts = [
    {
      Title: "Cómo la IA está transformando la industria financiera",
      Body: `## Introducción

La inteligencia artificial está revolucionando la forma en que operan las instituciones financieras. Desde la detección de fraudes hasta la personalización de servicios, los algoritmos de machine learning están creando ventajas competitivas sin precedentes.

## Detección de Fraudes

Los modelos de deep learning analizan patrones de transacciones en tiempo real, identificando anomalías con una precisión del **99.7%**. Esto representa una mejora del 40% respecto a los sistemas basados en reglas tradicionales.

### Resultados clave
- Reducción del 65% en falsos positivos
- Detección en menos de 200ms por transacción
- Cobertura de 15 tipos de fraude distintos

## Trading Algorítmico

Los fondos cuantitativos utilizan modelos de NLP para analizar:
- Reportes financieros trimestrales
- Noticias en tiempo real
- Sentimiento en redes sociales
- Datos macroeconómicos

## Conclusión

La adopción de IA en finanzas ya no es opcional. Las instituciones que no inviertan en estas tecnologías quedarán rezagadas en los próximos **3 a 5 años**.`,
      Author: "María Rodríguez",
      Status: "Published",
      Category: "Tecnología",
      Tags: ["IA", "Finanzas", "Machine Learning"],
      PublishedAt: "2026-04-28",
    },
    {
      Title: "Guía práctica de presupuesto para PyMEs",
      Body: `## Por qué presupuestar

Un presupuesto no es solo un documento financiero — es la **hoja de ruta** de tu negocio. Sin él, tomas decisiones a ciegas.

## Los 5 pasos esenciales

### 1. Proyectar ingresos
Analiza los últimos 12 meses y aplica un factor de crecimiento conservador (10-15% para PyMEs establecidas).

### 2. Categorizar gastos fijos
- Renta y servicios
- Nómina base
- Seguros y licencias
- Servicios de software

### 3. Estimar gastos variables
- Marketing (recomendado: 5-8% de ingresos)
- Inventario
- Comisiones de venta
- Viáticos

### 4. Reserva de emergencia
Mantén al menos **3 meses de gastos fijos** en una cuenta separada.

### 5. Revisión mensual
Compara presupuesto vs real cada mes. Ajusta trimestralmente.

## Herramientas recomendadas

Para empresas de 5-50 empleados, herramientas como Excel avanzado o software especializado son suficientes. Lo importante es la **disciplina**, no la herramienta.`,
      Author: "Carlos López",
      Status: "Published",
      Category: "Finanzas",
      Tags: ["PyMEs", "Presupuesto", "Gestión"],
      PublishedAt: "2026-05-01",
    },
    {
      Title: "Tendencias de Recursos Humanos 2026",
      Body: `## El futuro del trabajo

2026 marca un punto de inflexión en la gestión del talento. Las empresas que adapten sus prácticas de RRHH serán las que atraigan y retengan al mejor talento.

## Top 5 tendencias

### 1. Trabajo híbrido inteligente
Ya no es "remoto vs oficina". Es encontrar el **mix óptimo** para cada equipo y proyecto.

### 2. IA en reclutamiento
- Screening automatizado de CVs
- Entrevistas asistidas por IA
- Análisis predictivo de retención

### 3. Bienestar integral
- Salud mental como prioridad
- Horarios flexibles por defecto
- Presupuesto personal de bienestar

### 4. Upskilling continuo
- Microlearning diario (15 min)
- Rotación de proyectos cross-funcional
- Mentorship automatizado

### 5. Compensación transparente
- Bandas salariales públicas
- Equity para todos los niveles
- Revisiones trimestrales, no anuales

## Lo que NO cambia

La empatía, la comunicación clara y el liderazgo genuino siguen siendo las bases de una buena gestión de personas. La tecnología es un amplificador, no un sustituto.`,
      Author: "Patricia Morales",
      Status: "Published",
      Category: "RRHH",
      Tags: ["RRHH", "Tendencias", "Talento"],
      PublishedAt: "2026-05-02",
    },
    {
      Title: "Borrador: Seguridad informática básica",
      Body: "Contenido en desarrollo...",
      Author: "Pedro Hernández",
      Status: "Draft",
      Category: "Tecnología",
      Tags: ["Seguridad"],
    },
  ];

  for (const post of posts) {
    await run(`db content insert '${JSON.stringify(post).replace(/'/g, "\\'")}'`);
  }
  console.log(`   ${posts.length} posts created (${posts.filter(p => p.Status === "Published").length} published, ${posts.filter(p => p.Status === "Draft").length} draft)\n`);

  // 2. Generate the site
  console.log("2. Generating static site...\n");
  const r = await run(`report site content --title="NovaCorp Blog" --description="Insights de tecnología, finanzas y gestión empresarial" --brand=/brand/BRAND.md --output=/site --base-url=https://novacorp.github.io/blog`);
  console.log("   Result:", r.stdout);

  // 3. Extract files and save to disk
  console.log("\n3. Saving to disk...\n");
  const outDir = "/home/mauricioperera/Escritorio/just-bash-report/demo-site";
  mkdirSync(outDir, { recursive: true });

  const result = JSON.parse(r.stdout);
  for (const file of result.files) {
    const content = await bash.readFile(`/site/${file}`);
    writeFileSync(`${outDir}/${file}`, content);
    console.log(`   ${file} (${content.length} bytes)`);
  }

  // Also save RSS
  const rss = await bash.readFile("/site/rss.xml");
  writeFileSync(`${outDir}/rss.xml`, rss);

  console.log(`\n=== Done! Open ${outDir}/index.html in browser ===`);
}

main().catch(console.error);
