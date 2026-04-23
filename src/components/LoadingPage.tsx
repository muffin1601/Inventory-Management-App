/**
 * LoadingPage Component
 * Industrial, professional loading screen matching the system aesthetic
 */

import React from 'react';
import Image from 'next/image';
import styles from './LoadingPage.module.css';

export interface LoadingPageProps {
  message?: string;
  showBrand?: boolean;
  fullscreen?: boolean;
}

export function LoadingPage({
  message = 'Loading...',
  fullscreen = true,
}: LoadingPageProps) {
  return (
    <div className={`${styles.container} ${fullscreen ? styles.fullscreen : ''}`}>
      <div className={styles.minimalContent}>
        <div className={styles.spinner}></div>
        {message && <p className={styles.minimalMessage}>{message}</p>}
      </div>
    </div>
  );
}

/**
 * Skeleton Loader Component
 * Dense industrial style
 */
export function SkeletonLoader() {
  return (
    <div className={styles.skeleton}>
      <div className={styles.skeletonLine}></div>
      <div className={styles.skeletonLine} style={{ width: '90%' }}></div>
      <div className={styles.skeletonLine} style={{ width: '60%' }}></div>
    </div>
  );
}

/**
 * Table Skeleton Loader
 * Matching system tables
 */
export function TableSkeletonLoader() {
  return (
    <div className={styles.tableSkeleton}>
      {[1, 2, 3, 4, 5].map((row) => (
        <div key={row} className={styles.tableRow}>
          <div className={styles.skeletonCell}><div className={styles.cellInner}></div></div>
          <div className={styles.skeletonCell}><div className={styles.cellInner}></div></div>
          <div className={styles.skeletonCell}><div className={styles.cellInner}></div></div>
          <div className={styles.skeletonCell}><div className={styles.cellInner}></div></div>
        </div>
      ))}
    </div>
  );
}

/**
 * Card Skeleton Loader
 * Flat card style
 */
export function CardSkeletonLoader() {
  return (
    <div className={styles.skeleton} style={{ minHeight: '120px', justifyContent: 'space-between' }}>
      <div className={styles.skeletonLine} style={{ height: '20px', width: '40%' }}></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className={styles.skeletonLine}></div>
        <div className={styles.skeletonLine} style={{ width: '80%' }}></div>
      </div>
    </div>
  );
}

/**
 * Mini Loader
 * For inline loading
 */
export function MiniLoader() {
  return (
    <div className={styles.miniLoader}>
      <div className={styles.miniSpinner}></div>
    </div>
  );
}

export default LoadingPage;
