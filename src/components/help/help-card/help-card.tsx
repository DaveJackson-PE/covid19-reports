import {
  Button,
  Card,
  CardActions,
  CardContent,
} from '@material-ui/core';
import React, { ReactNode } from 'react';
import {
  useDispatch,
  useSelector,
} from 'react-redux';
import { HelpCard as HelpCardActions } from '../../../actions/help-card.actions';
import { AppState } from '../../../store';
import { HelpContent } from '../help-content/help-content';
import useStyles from './help-card.styles';

export interface HelpCardProps {
  helpCardId: string
  children?: ReactNode
}

export const HelpCard = (props: HelpCardProps) => {
  const { helpCardId, children } = props;
  const classes = useStyles();
  const dispatch = useDispatch();
  const hide = useSelector<AppState, boolean>(state => state.localStorage.hideHelpCard?.[helpCardId] ?? false);

  const handleGotItClick = () => {
    dispatch(HelpCardActions.hide(helpCardId));
  };

  if (hide) {
    return null;
  }

  return (
    <Card className={classes.card}>
      <CardContent className={classes.cardContent}>
        <HelpContent>
          {children}
        </HelpContent>
      </CardContent>

      <CardActions className={classes.cardActions}>
        <Button onClick={handleGotItClick}>Ok, I got it</Button>
      </CardActions>
    </Card>
  );
};
