"use client";

import React from 'react';
import styles from './ComingSoon.module.css';

export default function ComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.subtitle}>{description}</p>
      <div className={styles.card}>
        <div className={styles.hint}>This screen is being prepared. If you need it urgently, please contact admin.</div>
      </div>
    </div>
  );
}

