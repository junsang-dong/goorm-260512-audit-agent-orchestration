import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 11, fontFamily: "Helvetica" },
  h1: { fontSize: 18, marginBottom: 12 },
  h2: { fontSize: 13, marginTop: 10, marginBottom: 6 },
  p: { marginBottom: 4, lineHeight: 1.35 },
  box: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 8,
    marginBottom: 8,
  },
});

export interface AuditPdfProps {
  companyName: string;
  runId: string;
  riskScore: number | null;
  synthesis: string;
  heatmapLines: { label: string; level: string }[];
}

export function AuditPdfDocument(props: AuditPdfProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>재무 이상징후 감사 요약</Text>
        <Text style={styles.p}>기업: {props.companyName}</Text>
        <Text style={styles.p}>분석 ID: {props.runId}</Text>
        <Text style={styles.p}>
          Risk Score (0-100, 높을수록 위험):{" "}
          {props.riskScore ?? "N/A"}
        </Text>
        <Text style={styles.h2}>Risk Heatmap</Text>
        <View style={styles.box}>
          {props.heatmapLines.map((h) => (
            <Text key={h.label} style={styles.p}>
              {h.label}: {h.level}
            </Text>
          ))}
        </View>
        <Text style={styles.h2}>AI 감사 메모 (통합)</Text>
        <Text style={styles.p}>{props.synthesis}</Text>
      </Page>
    </Document>
  );
}
