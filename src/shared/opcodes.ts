/**
 * Zentrale Registry: **Binär-First-Bytes**, **Macro-Opcodes** (Planung) und **MORG_*-Textmarker**.
 *
 * ## Kollisionsanalyse (kurz)
 *
 * 1. **`emergency-binary-wire.ts` (LoRa Emergency v2)**  
 *    Byte `[0] = 0x02` ist **Versions-Identifikator**, kein Anwendungs-Makro. Spiegel: `lora-bridge/src/emergency-binary.ts`.  
 *    → Liegt im Bereich **0x00–0x3F** (Envelope/Version). **Kein** Konflikt mit **MacroOpcode** 0x40–0xB0, solange Makros **nicht** dasselbe Rohframe-Layout ohne Wrapper nutzen.
 *
 * 2. **MORG_*-„Wires“**  
 *    Transport über **Klartext-Marker** `[[MORG_…:…]]` in UTF-8 (siehe `MorgTextWireMarker`).  
 *    → Anderer **Namespace** als Ein-Byte-Opcodes; keine Byte-Kollision mit 0x40–0xB0.
 *
 * 3. **Mesh-v2-Fragmentierung**  
 *    Eigener Header `[[MF1:…]]` in `mesh-v2-fragment.ts` – ebenfalls **Text**, kein 0x40-Byte-Opcode.
 *
 * 4. **Macro-Opcodes 0x40–0xB0**  
 *    Geplant für **kompakte Binär-Makros** (`docs/MACRO-BIDIRECTIONAL-SPEC.md`).  
 *    Werte **0x41–0x4F** usw. zwischen den „Haupt“-Slots sind für **Sub-Typen / Revision** reservierbar (nicht frei für andere Protokolle ohne Review).
 *
 * Bei neuen **binären** Ersten-Byte-Werten: zuerst dieses File erweitern und mit Emergency-**0x02** sowie dem Block **0x40–0xFF** (Makro-Ebene) abgleichen.
 */

/** Erstes Byte des Emergency-Binary-v2-Frames — muss mit `emergency-binary-wire.ts` / `lora-bridge` übereinstimmen. */
export const EmergencyBinaryWireVersionByte = 0x02 as const;

/**
 * Geplante Makro-Opcodes (Wald↔Netz). Nur verwenden, wenn das **Frame-Layout** festliegt
 * (nicht mit Emergency-v2-Header verwechseln).
 */
export enum MacroOpcode {
    /** Upstream: Sensor-/Ereignis-Trigger → Audit/IOTA */
    EventTrigger = 0x40,
    /** Upstream: signierter Standort-/Checkpoint-Nachweis */
    PresenceLog = 0x50,
    /** Upstream/Downstream: komprimierte Informationsabfrage / Kurzantwort */
    DataQuery = 0x60,
    /** Downstream: Nahbereichs-Beacon (akustisch/visuell) */
    BeaconMode = 0x70,
    /** Downstream: Infrastruktur (Schloss, Relais, …) */
    InfrastructureControl = 0x80,
    /** Downstream: Power-/Battery-Profile */
    PowerCommander = 0x90,
    /** Upstream: Breadcrumb / Delta-Pfad */
    BreadcrumbEcho = 0xa0,
    /** Upstream/lokal: Mesh-Topologie / RSSI */
    MeshTopologyDiscovery = 0xb0,
}

/** Untergrenze inklusive für reservierte Macro-Hauptslots (Spez). */
export const MACRO_OPCODE_RANGE_MIN = 0x40 as const;
/** Obergrenze inklusive (0xB0). */
export const MACRO_OPCODE_RANGE_MAX = 0xb0 as const;

export function isMacroOpcodeMainSlot(b: number): boolean {
    return (
        b === MacroOpcode.EventTrigger ||
        b === MacroOpcode.PresenceLog ||
        b === MacroOpcode.DataQuery ||
        b === MacroOpcode.BeaconMode ||
        b === MacroOpcode.InfrastructureControl ||
        b === MacroOpcode.PowerCommander ||
        b === MacroOpcode.BreadcrumbEcho ||
        b === MacroOpcode.MeshTopologyDiscovery
    );
}

/**
 * QoS / Sendepriorität (BOS-ähnlich) – **getrennt** von der Opcode-Zahl.
 * Keine Hex-Umnummerierung nötig; Priorität steuert Warteschlange / Defer.
 * Siehe `docs/MACRO-OPERATIONAL-PATTERNS.md`.
 */
export enum MacroPriorityClass {
    /** Sofort / Notfall – unterbricht deferbare Klassen (Policy). */
    Flash = 1,
    /** Lage, Steuerung, Energie – wenige Sekunden Verzögerung ok. */
    Operational = 2,
    /** Beacon / Team-Hinweise ohne Notfall. */
    Routine = 3,
    /** Wetter, Breadcrumbs, Diagnose – nur bei niedriger Funklast. */
    Background = 4,
}

/**
 * Standard-Zuordnung Macro → Priorität (anpassen nach Feldtests).
 * `InfrastructureControl` kann in manchen Einsätzen als Flash behandelt werden – dann Policy-Override, nicht Opcode-Wechsel.
 */
export function macroPriorityClass(op: MacroOpcode): MacroPriorityClass {
    switch (op) {
        case MacroOpcode.EventTrigger:
            return MacroPriorityClass.Flash;
        case MacroOpcode.PresenceLog:
        case MacroOpcode.InfrastructureControl:
        case MacroOpcode.PowerCommander:
            return MacroPriorityClass.Operational;
        case MacroOpcode.BeaconMode:
            return MacroPriorityClass.Routine;
        case MacroOpcode.DataQuery:
        case MacroOpcode.BreadcrumbEcho:
        case MacroOpcode.MeshTopologyDiscovery:
            return MacroPriorityClass.Background;
        default: {
            const _x: never = op;
            return MacroPriorityClass.Routine;
        }
    }
}

/** Bytes 0x00–0x3F: u. a. Emergency-v2-Version (0x02). Keine Macro-Hauptslots. */
export const BINARY_ENVELOPE_VERSION_BYTE_MAX = 0x3f as const;

/**
 * Alle bekannten **Text-Marker** für MORG-Inhalte (Reihenfolge: grob IOTA/Allgemein → LoRa → Meta).
 * Einheitliche Quelle für Docs/Tooling; Laufzeitpfade importieren diese Konstanten schrittweise.
 */
export const MorgTextWireMarker = {
    COMPACT_IMG_V1: '[[MORG_COMPACT_IMG_V1:' as const,
    TXT_V1: '[[MORG_TXT_V1:' as const,
    FILE_TXT_V1: '[[MORG_FILE_TXT_V1:' as const,
    AUDIO_V1: '[[MORG_AUDIO_V1:' as const,
    LUMA_V1: '[[MORG_LUMA_V1:' as const,
    CHROMA_V1: '[[MORG_CHROMA_V1:' as const,
    SLIDE_V1: '[[MORG_SLIDE_V1:' as const,
    PROTOKOLL_ANCHOR_V1: '[[MORG_PROTOKOLL_ANCHOR_V1:' as const,
    /** Text-Hülle: Hilferuf vor Nutzlast (Klartext vor AES-GCM / Mesh); siehe `morg-emergency-v1-text.ts` + `docs/MORG-EMERGENCY-SOS-WIRE-SPEC.md` */
    EMERGENCY_V1: '[[MORG_EMERGENCY_V1:' as const,
    /** Optional: Empfangsbestätigung für SOS (SHA-256 der Originalnutzlast); siehe `morg-sos-ack-wire.ts` */
    SOS_ACK_V1: '[[MORG_SOS_ACK_V1:' as const,
    /** Platzhalter-Zeile für Delayed-Upload-Spiegel (exakt dieser String) */
    DELAY_MIRROR_V1: '[[MORG_DELAY_MIRROR_V1]]' as const,
    /** Body mit angehängtem Wire nach Newline */
    LORA_IOTA_MIRROR_V1_PREFIX: '[[MORG_LORA_IOTA_MIRROR_V1]]' as const,
} as const;

export type MorgTextWireMarkerKey = keyof typeof MorgTextWireMarker;

/** Mesh-v2-Reassembly-Header (Text), nicht MORG_* — siehe `src/mesh-v2-fragment.ts`. */
export const MeshV2FragmentHeaderPrefix = '[[MF1:' as const;
