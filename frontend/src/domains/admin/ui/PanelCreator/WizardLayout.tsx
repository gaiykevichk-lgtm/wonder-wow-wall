/**
 * Phase Panel Creator Wizard — shared wizard layout.
 *
 * Renders the step indicator and navigation buttons.
 */

import React from 'react';
import { Button, Steps, Typography } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import type { WizardStep } from '../../model/panelCreatorStore';
import { STEP_LABELS } from './constants';

const { Title } = Typography;

const APPLE_EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1.0];
const fadeUpVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: APPLE_EASE, delay: i * 0.08 },
  }),
};

interface WizardLayoutProps {
  currentStep: WizardStep;
  onNext: () => void;
  onBack: () => void;
  onReset?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  children: React.ReactNode;
  showBack?: boolean;
}

export function WizardLayout({
  currentStep,
  onNext,
  onBack,
  onReset,
  nextLabel = 'Далее',
  nextDisabled = false,
  nextLoading = false,
  children,
  showBack = true,
}: WizardLayoutProps) {
  const isLastStep = currentStep === 4;

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeUpVariants}
        style={{ marginBottom: 32 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Title level={3} style={{ margin: 0 }}>
            Panel Creator
          </Title>
          {onReset && (
            <Button onClick={onReset} danger>
              Начать сначала
            </Button>
          )}
        </div>
      </motion.div>

      {/* Steps indicator */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeUpVariants}
        custom={1}
        style={{ marginBottom: 32 }}
      >
        <Steps
          current={currentStep - 1}
          items={STEP_LABELS.map((label, i) => ({
            title: label,
            status:
              i + 1 < currentStep
                ? 'finish'
                : i + 1 === currentStep
                  ? 'process'
                  : 'wait',
          }))}
        />
      </motion.div>

      {/* Content */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeUpVariants}
        custom={2}
        style={{ marginBottom: 32 }}
      >
        {children}
      </motion.div>

      {/* Navigation */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeUpVariants}
        custom={3}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          borderTop: '1px solid #f0f0f0',
          paddingTop: 24,
        }}
      >
        <div>
          {showBack && currentStep > 1 && (
            <Button icon={<LeftOutlined />} onClick={onBack} size="large">
              Назад
            </Button>
          )}
        </div>

        <div>
          {isLastStep ? null : (
            <Button
              type="primary"
              onClick={onNext}
              disabled={nextDisabled}
              loading={nextLoading}
              size="large"
              icon={<RightOutlined />}
              iconPosition="end"
            >
              {nextLabel}
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
