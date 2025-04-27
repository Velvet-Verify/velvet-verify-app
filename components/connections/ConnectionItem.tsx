// components/connections/ConnectionItem.tsx
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTheme } from 'styled-components/native';
import { Timestamp } from 'firebase/firestore';

export interface Connection {
  displayName: string | null;
  imageUrl:    string | null;
  createdAt:   any;
  updatedAt?:  any;
  connectionLevel:  number;
  connectionStatus: number;  // 0=pending, 1=active
  senderSUUID:   string;
  recipientSUUID:string;

  /* extras for pending-elevation merge */
  pendingDocId?: string;
  pendingSenderSUUID?: string;
  pendingRecipientSUUID?: string;
}

interface Props {
  connection: Connection;
  mySUUID?:   string;
  highlight?: boolean;
}

export function ConnectionItem({ connection, mySUUID, highlight=false }: Props) {
  const theme = useTheme();
  const displayName = connection.displayName || 'Unknown';

  /* -------- subtitle (date or status) -------- */
  const dateStr = formatDate(connection.updatedAt ?? connection.createdAt);

  let subtitle: string | null = dateStr;

  // Show “Request Sent / Elevation Request Sent” to the **sender** only
  if (connection.connectionStatus === 0 && connection.senderSUUID === mySUUID) {
    subtitle = 'Request Sent';
  } else if (connection.pendingDocId && connection.pendingSenderSUUID === mySUUID) {
    subtitle = 'Elevation Request Sent';
  }

  return (
    <View style={[styles.row, highlight && styles.highlight]}>
      {highlight && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>NEW</Text>
        </View>
      )}

      {connection.imageUrl
        ? <Image source={{ uri: connection.imageUrl }} style={styles.avatar} />
        : <View style={styles.placeholder} />}

      <View style={styles.info}>
        <Text style={[theme.bodyText, styles.name]}>{displayName}</Text>
        {subtitle && <Text style={[theme.bodyText, styles.sub]}>{subtitle}</Text>}
      </View>
    </View>
  );
}

/* -------- helpers -------- */
function formatDate(v: any): string | null {
  if (!v) return null;
  let d: Date | null = null;
  if (v instanceof Timestamp)                d = v.toDate();
  else if (typeof v === 'object' && v.seconds) d = new Date(v.seconds * 1000);
  else if (typeof v === 'string') {
    const p = new Date(v); if (!isNaN(p.getTime())) d = p;
  }
  return d ? d.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' }) : null;
}

/* -------- styles -------- */
const styles = StyleSheet.create({
  row: { flexDirection:'row', alignItems:'center', marginVertical:8 },
  highlight: { backgroundColor:'#fffbe6' },

  avatar:     { width:50, height:50, borderRadius:25, marginRight:10 },
  placeholder:{ width:50, height:50, borderRadius:25, marginRight:10, backgroundColor:'#ccc' },
  info:       { flex:1 },
  name:       { fontWeight:'bold', marginBottom:2 },
  sub:        { fontSize:14, opacity:0.8, marginTop:2 },

  badge:{ position:'absolute', top:2, right:2, backgroundColor:'crimson',
          paddingHorizontal:6, paddingVertical:2, borderRadius:4, zIndex:1 },
  badgeText:{ color:'#fff', fontSize:10, fontWeight:'bold' },
});
