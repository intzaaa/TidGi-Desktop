// @flow
import React from 'react';
import { useTranslation } from 'react-i18next';

import Paper from '@material-ui/core/Paper';
import AppBar from '@material-ui/core/AppBar';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';

function a11yProps(index) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

export interface IProps {
  currentTab: number;
  currentTabSetter: number => void;
}
export default function TabBar({ currentTab, currentTabSetter }: IProps) {
  const { t } = useTranslation();
  return (
    <AppBar position="static">
      <Paper square>
        <Tabs
          value={currentTab}
          onChange={(event, newValue) => currentTabSetter(newValue)}
          aria-label={t('AddWorkspace.SwitchCreateNewOrOpenExisted')}
        >
          <Tab label={t('AddWorkspace.CreateNewWiki')} {...a11yProps(0)} />
          <Tab label={t('AddWorkspace.OpenLocalWiki')} {...a11yProps(1)} />
          <Tab label={t('AddWorkspace.CloneOnlineWiki')} {...a11yProps(2)} />
        </Tabs>
      </Paper>
    </AppBar>
  );
}
