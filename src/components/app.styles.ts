import { createStyles, Theme } from '@material-ui/core';
import { makeStyles } from '@material-ui/styles';
import { sidenavWidthCollapsed, sidenavWidthExpanded } from './app-sidenav/app-sidenav.styles';

export default makeStyles((theme: Theme) => createStyles({
  content: {
    transition: theme.transitions.create('margin-left', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  },
  contentSidenavExpanded: {
    marginLeft: sidenavWidthExpanded,
  },
  contentSidenavCollapsed: {
    marginLeft: sidenavWidthCollapsed,
  },
}));