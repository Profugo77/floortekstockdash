
# FloorTek Stock — Plan de Implementación

## Identidad Visual
- Paleta: verde primario `#1B7F6A`, negro `#111111`, blanco `#FFFFFF`
- Estilo: moderno, minimalista, industrial
- Responsive (foco desktop, funcional en móvil)
- Logo: "FloorTek Stock" + subtítulo "Control inteligente de inventario"

---

## Arquitectura
- **Backend**: Lovable Cloud (base de datos + autenticación + funciones serverless)
- **Autenticación**: Login con email y contraseña para equipo de 2-5 usuarios
- **IA de voz**: Lovable AI (Gemini Flash) interpreta el texto dictado y genera el movimiento

---

## Módulos a implementar

### 1. Autenticación
- Pantalla de login con email y contraseña
- Rutas protegidas (todo el sistema requiere sesión)
- Posibilidad de registrar usuarios por el administrador

### 2. Gestión de Productos
- Tabla con: nombre (único), categoría (SPC, Porcelanato, Adhesivos, Zócalos, otros), unidad (m², cajas, unidades), stock actual, stock mínimo, fecha de creación
- CRUD completo: agregar, editar, eliminar
- Importación desde CSV (nombre, categoría, unidad, stock inicial, stock mínimo)
- Validación de nombres duplicados

### 3. Movimientos de Stock
- Registrar entradas y salidas por producto
- Selección de producto por nombre, tipo (entrada/salida), cantidad, fecha (editable, por defecto hoy), observaciones opcionales
- Regla: no se permite stock negativo
- Historial completo con filtros por fecha y producto

### 4. Registro por Voz con IA
- Botón de micrófono (Web Speech API para capturar audio)
- El texto dictado se envía a una función serverless con Lovable AI (Gemini Flash)
- La IA interpreta: tipo (entrada/salida), cantidad y nombre del producto
- Se muestra una tarjeta de confirmación antes de guardar el movimiento
- Manejo de errores si el producto no existe o la frase es ambigua

### 5. Dashboard Principal
- Tarjetas con: total de productos, stock total acumulado, productos bajo mínimo (alerta roja), movimientos del día
- Gráfico de barras: entradas vs salidas del día actual
- Lista rápida de productos bajo stock mínimo con acceso directo

### 6. Resumen Diario
- Selector de fecha
- Totales del día: entradas, salidas, balance neto
- Lista detallada de todos los movimientos del día
- Top 5 productos con más salidas ese día
- Gráfico de entradas vs salidas por los últimos 7 días

### 7. Análisis de Rotación
- Ranking de productos con más salidas (últimos 30 y 90 días)
- Producto con mayor rotación del período
- Productos sin movimiento
- Gráfico de tendencia mensual por productos seleccionados

---

## Navegación
Sidebar izquierdo (colapsable) con secciones:
- Dashboard
- Productos
- Movimientos
- Resumen Diario
- Análisis
- Configuración (gestión de usuarios)
