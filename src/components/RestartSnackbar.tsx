import React, { useCallback, useState, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import { Snackbar, Button, IconButton, Tooltip } from '@material-ui/core';
import { Close as CloseIcon } from '@material-ui/icons';
import { useTranslation } from 'react-i18next';
import { useDebouncedFn } from 'beautiful-react-hooks';

const progressAnimation = keyframes`
  from {
    width: 0%;
  }

  to {
    width: 100%;
  }
`;
const RestartButton = styled(Button)<{ currentWaitBeforeRestart: number }>`
  .MuiButton-label {
    z-index: 1;
  }
  .MuiTouchRipple-root {
    z-index: 0;
    background-color: white;
    animation: ${progressAnimation} ${({ currentWaitBeforeRestart }) => currentWaitBeforeRestart}ms linear;
  }
`;

export function useRestartSnackbar(waitBeforeCountDown = 1000, waitBeforeRestart = 10_000): [() => void, JSX.Element] {
  const { t } = useTranslation();
  const [opened, openedSetter] = useState(false);
  const [inCountDown, inCountDownSetter] = useState(false);
  const [currentWaitBeforeRestart, currentWaitBeforeRestartSetter] = useState(waitBeforeRestart);

  const handleCloseAndRestart = useCallback(() => {
    openedSetter(false);
    inCountDownSetter(false);
    void window.service.window.requestRestart();
  }, [openedSetter]);

  const handleCancelRestart = useCallback(() => {
    openedSetter(false);
    inCountDownSetter(false);
  }, [openedSetter]);

  const startRestartCountDown = useDebouncedFn(
    () => {
      inCountDownSetter(true);
      openedSetter(true);
    },
    waitBeforeCountDown,
    { leading: false },
    [openedSetter, inCountDown, inCountDownSetter],
  );

  const requestRestartCountDown = useCallback(() => {
    if (inCountDown) {
      // if already started,refresh count down of autoHideDuration, so the count down will rerun
      // so if user is editing userName in the config, count down will refresh on each onChange of Input
      currentWaitBeforeRestartSetter(currentWaitBeforeRestart + 1);
    } else {
      // of not started, we try start it
      startRestartCountDown();
    }
  }, [inCountDown, currentWaitBeforeRestart, startRestartCountDown]);

  return [
    requestRestartCountDown,
    <div key="RestartSnackbar">
      <Snackbar
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        open={opened}
        onClose={handleCloseAndRestart}
        message={t('Dialog.RestartMessage')}
        autoHideDuration={currentWaitBeforeRestart}
        action={
          <>
            <RestartButton
              key={currentWaitBeforeRestart}
              currentWaitBeforeRestart={currentWaitBeforeRestart}
              color="secondary"
              size="small"
              onClick={handleCloseAndRestart}>
              {t('Dialog.RestartNow')}
            </RestartButton>
            <Tooltip title={<span>{t('Dialog.Later')}</span>}>
              <IconButton size="small" aria-label="close" color="inherit" onClick={handleCancelRestart}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        }
      />
    </div>,
  ];
}
