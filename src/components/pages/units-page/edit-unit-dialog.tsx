import React, { useState } from 'react';
import {
  Avatar,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@material-ui/core';
import AddCircleIcon from '@material-ui/icons/AddCircle';
import HighlightOffIcon from '@material-ui/icons/HighlightOff';
import axios from 'axios';
import moment from 'moment-timezone';
import { v4 as uuidv4 } from 'uuid';
import { Autocomplete } from '@material-ui/lab';
import { MuiPickersUtilsProvider, TimePicker } from '@material-ui/pickers';
import MomentUtils from '@date-io/moment';
import { MaterialUiPickersDate } from '@material-ui/pickers/typings/date';
import useStyles from './edit-unit-dialog.styles';
import { ApiUnit, MusterConfiguration } from '../../../models/api-response';
import {
  dayIsIn, DaysOfTheWeek, nextDay, oneDaySeconds,
} from '../../../utility/days';

export interface EditUnitDialogProps {
  open: boolean,
  orgId?: number,
  unit?: ApiUnit,
  onClose?: () => void,
  onError?: (error: string) => void,
}

interface MusterConfigurationRow extends MusterConfiguration {
  rowKey: string,
  durationHours: number,
  startTimeDate: Date,
}

interface MusterWindow {
  start: number,
  end: number,
}

export const EditUnitDialog = (props: EditUnitDialogProps) => {
  const classes = useStyles();
  const [formDisabled, setFormDisabled] = useState(false);
  const {
    open, orgId, unit, onClose, onError,
  } = props;

  const musterRows = (musterConfiguration?: MusterConfiguration[]) => {
    const today = moment().format('Y-M-D');
    return musterConfiguration?.map(muster => {
      return {
        ...muster,
        durationHours: muster.durationMinutes / 60,
        rowKey: uuidv4(),
        startTimeDate: moment(`${today} ${muster.startTime}`, 'Y-M-D h:mm').toDate(),
      };
    });
  };

  const existingUnit: boolean = !!unit;
  const [id, setId] = useState(unit?.id || '');
  const [name, setName] = useState(unit?.name || '');
  const [musterConfiguration, setMusterConfiguration] = useState<MusterConfigurationRow[]>(musterRows(unit?.musterConfiguration) || []);
  const [errorMessage, setErrorMessage] = React.useState<null | string>(null);

  if (!open) {
    return <></>;
  }

  const onUnitChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    setId(event.target.value.replace(/[^a-z0-9_]/gi, '').toLowerCase());
  };

  const onInputChanged = (func: (f: string) => any) => (event: React.ChangeEvent<HTMLInputElement>) => {
    func(event.target.value);
  };

  const addMusterWindow = () => {
    const configuration = [...musterConfiguration, {
      days: DaysOfTheWeek.None,
      startTime: '00:00',
      timezone: moment.tz.guess(),
      durationMinutes: 120,
      durationHours: 2,
      rowKey: uuidv4(),
      startTimeDate: moment(`${moment().format('Y-M-D')} 00:00`, 'Y-M-D h:mm').toDate(),
    }];
    setMusterConfiguration(configuration);
  };

  const resetErrorMessage = () => {
    if (errorMessage) {
      setErrorMessage(null);
    }
  };

  const setMusterTimezone = (rowKey: string) => (_: any, timezone: string) => {
    const configuration = [...musterConfiguration];
    const index = configuration.findIndex(muster => muster.rowKey === rowKey);
    if (index >= 0) {
      configuration[index].timezone = timezone;
    }
    setMusterConfiguration(configuration);
    resetErrorMessage();
  };

  const setMusterDuration = (rowKey: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    let value = Math.max(0.5, parseFloat(event.target.value));
    if (Number.isNaN(value)) {
      value = 0.5;
    }
    const configuration = [...musterConfiguration];
    const index = configuration.findIndex(muster => muster.rowKey === rowKey);
    if (index >= 0) {
      configuration[index].durationHours = value;
      configuration[index].durationMinutes = value * 60;
    }
    setMusterConfiguration(configuration);
    resetErrorMessage();
  };

  const setMusterStartTime = (rowKey: string) => (date: MaterialUiPickersDate) => {
    if (!date) {
      return;
    }
    const configuration = [...musterConfiguration];
    const index = configuration.findIndex(muster => muster.rowKey === rowKey);
    if (index >= 0) {
      configuration[index].startTimeDate = date.toDate();
      configuration[index].startTime = date.format('H:mm');
    }
    setMusterConfiguration(configuration);
    resetErrorMessage();
  };

  const toggleMusterDay = (rowKey: string, day: DaysOfTheWeek) => () => {
    const configuration = [...musterConfiguration];
    const index = configuration.findIndex(muster => muster.rowKey === rowKey);
    if (index >= 0) {
      // eslint-disable-next-line no-bitwise
      configuration[index].days ^= day;
    }
    if (!configuration.find(muster => muster.days === DaysOfTheWeek.None)) {
      resetErrorMessage();
    }
    setMusterConfiguration(configuration);
  };

  const removeMusterWindow = (rowKey: string) => {
    setMusterConfiguration(previous => {
      const configuration = [...previous];
      const index = configuration.findIndex(muster => muster.rowKey === rowKey);
      if (index >= 0) {
        configuration.splice(index, 1);
      }
      return configuration;
    });
  };

  const validateMusterWindows = () => {
    if (musterConfiguration.find(muster => muster.days === DaysOfTheWeek.None)) {
      setErrorMessage('Please select one or more days.');
      return false;
    }

    const windows: MusterWindow[] = [];
    // Go through each configuration and add the time ranges for muster windows over a test week
    musterConfiguration.forEach(muster => {
      // Parse the start time
      const musterTime = moment(muster.startTime, 'HH:mm');
      // Get the unix timestamp of the first possible muster window of the week
      let current = moment()
        .tz(muster.timezone)
        .startOf('week')
        .add(musterTime.hours(), 'hours')
        .add(musterTime.minutes(), 'minutes')
        .unix();
      const firstWindowIndex = windows.length;
      // Loop through each day and add any that are set in this muster configuration
      for (let day = DaysOfTheWeek.Sunday; day <= DaysOfTheWeek.Saturday; day = nextDay(day)) {
        if (dayIsIn(day, muster.days)) {
          windows.push({
            start: current,
            end: current + muster.durationMinutes * 60,
          });
        }
        current += oneDaySeconds;
      }

      // Add the first window of next week to make sure we don't overlap over the week boundary
      windows.push({
        start: windows[firstWindowIndex].start + oneDaySeconds * 7,
        end: windows[firstWindowIndex].end + oneDaySeconds * 7,
      });
    });

    // Sort all muster windows by start time
    windows.sort((a: MusterWindow, b: MusterWindow) => {
      return a.start - b.start;
    });

    // Make sure none overlap
    for (let i = 0; i < windows.length - 1; i++) {
      if (windows[i].end > windows[i + 1].start) {
        setErrorMessage('Unable to use overlapping muster windows.');
        return false;
      }
    }

    return true;
  };

  const onSave = async () => {
    if (!validateMusterWindows()) {
      return;
    }
    setFormDisabled(true);
    const body = {
      id,
      name,
      musterConfiguration: musterConfiguration.map(muster => {
        return {
          days: muster.days,
          startTime: muster.startTime,
          timezone: muster.timezone,
          durationMinutes: muster.durationMinutes,
        };
      }),
    };
    try {
      if (existingUnit) {
        await axios.put(`api/unit/${orgId}/${unit!.id}`, body);
      } else {
        await axios.post(`api/unit/${orgId}`, body);
      }
    } catch (error) {
      if (onError) {
        let message = 'Internal Server Error';
        if (error.response?.data?.errors && error.response.data.errors.length > 0) {
          message = error.response.data.errors[0].message;
        }
        onError(message);
      }
      setFormDisabled(false);
      return;
    }
    if (onClose) {
      onClose();
    }
  };

  const canSave = () => {
    return !formDisabled && id.length > 0 && name.length > 0;
  };

  const dayButtonClass = (muster: MusterConfigurationRow, day: DaysOfTheWeek) => {
    if (errorMessage && muster.days === DaysOfTheWeek.None) {
      return classes.dayButtonError;
    }
    // eslint-disable-next-line no-bitwise
    return muster.days & day ? classes.dayButtonOn : classes.dayButtonOff;
  };

  /* eslint-disable no-bitwise */
  return (
    <Dialog className={classes.root} maxWidth="md" onClose={onClose} open={open}>
      <DialogTitle id="alert-dialog-title">{existingUnit ? 'Edit Unit' : 'New Unit'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={3}>
          <Grid item xs={6}>
            <Typography className={classes.headerLabel}>ID</Typography>
            <TextField
              className={classes.textField}
              id="unit-id"
              disabled={formDisabled || existingUnit}
              value={id}
              onChange={onUnitChanged}
              helperText="Lowercase letters, numbers, and underscores are allowed"
            />
          </Grid>
          <Grid item xs={6}>
            <Typography className={classes.headerLabel}>Name</Typography>
            <TextField
              className={classes.textField}
              id="unit-name"
              disabled={formDisabled}
              value={name}
              onChange={onInputChanged(setName)}
            />
          </Grid>
          <Grid item xs={12}>
            <Typography className={classes.headerLabel}>Muster Configuration</Typography>
            <Button
              className={classes.addMusterButton}
              color="primary"
              variant="text"
              size="small"
              startIcon={<AddCircleIcon />}
              onClick={addMusterWindow}
            >
              Add New Muster Window
            </Button>
            {musterConfiguration.length > 0 && (
              <Table aria-label="muster table" className={classes.musterTable}>
                <TableHead>
                  <TableRow>
                    <TableCell>Days</TableCell>
                    <TableCell>Start Time</TableCell>
                    <TableCell>Time Zone</TableCell>
                    <TableCell>Duration (Hrs)</TableCell>
                    <TableCell className={classes.iconCell} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {musterConfiguration.map(muster => (
                    <TableRow key={muster.rowKey}>
                      <TableCell>
                        <div className={classes.dayButtons}>
                          <Avatar
                            className={dayButtonClass(muster, DaysOfTheWeek.Sunday)}
                            onClick={toggleMusterDay(muster.rowKey, DaysOfTheWeek.Sunday)}
                          >
                            Su
                          </Avatar>
                          <Avatar
                            className={dayButtonClass(muster, DaysOfTheWeek.Monday)}
                            onClick={toggleMusterDay(muster.rowKey, DaysOfTheWeek.Monday)}
                          >
                            Mo
                          </Avatar>
                          <Avatar
                            className={dayButtonClass(muster, DaysOfTheWeek.Tuesday)}
                            onClick={toggleMusterDay(muster.rowKey, DaysOfTheWeek.Tuesday)}
                          >
                            Tu
                          </Avatar>
                          <Avatar
                            className={dayButtonClass(muster, DaysOfTheWeek.Wednesday)}
                            onClick={toggleMusterDay(muster.rowKey, DaysOfTheWeek.Wednesday)}
                          >
                            We
                          </Avatar>
                          <Avatar
                            className={dayButtonClass(muster, DaysOfTheWeek.Thursday)}
                            onClick={toggleMusterDay(muster.rowKey, DaysOfTheWeek.Thursday)}
                          >
                            Th
                          </Avatar>
                          <Avatar
                            className={dayButtonClass(muster, DaysOfTheWeek.Friday)}
                            onClick={toggleMusterDay(muster.rowKey, DaysOfTheWeek.Friday)}
                          >
                            Fr
                          </Avatar>
                          <Avatar
                            className={dayButtonClass(muster, DaysOfTheWeek.Saturday)}
                            onClick={toggleMusterDay(muster.rowKey, DaysOfTheWeek.Saturday)}
                          >
                            Sa
                          </Avatar>
                        </div>
                      </TableCell>
                      <TableCell>
                        <MuiPickersUtilsProvider utils={MomentUtils}>
                          <TimePicker
                            id={`muster-start-time-${muster.rowKey}`}
                            disabled={formDisabled}
                            value={muster.startTimeDate}
                            InputProps={{ disableUnderline: true }}
                            onChange={setMusterStartTime(muster.rowKey)}
                          />
                        </MuiPickersUtilsProvider>
                      </TableCell>
                      <TableCell className={classes.timeZoneCell}>
                        <Autocomplete
                          id={`muster-timezone-${muster.rowKey}`}
                          value={muster.timezone}
                          disabled={formDisabled}
                          disableClearable
                          options={moment.tz.names()}
                          noOptionsText="No matching time zones"
                          renderInput={params => (
                            <TextField {...params} InputProps={{ ...params.InputProps, disableUnderline: true }} />
                          )}
                          onChange={setMusterTimezone(muster.rowKey)}
                        />
                      </TableCell>
                      <TableCell className={classes.durationCell}>
                        <TextField
                          disabled={formDisabled}
                          onChange={setMusterDuration(muster.rowKey)}
                          value={muster.durationHours}
                          type="number"
                          inputProps={{ min: '0.5', step: '0.5' }}
                        />
                      </TableCell>
                      <TableCell className={classes.iconCell}>
                        <IconButton
                          aria-label="remove muster window"
                          onClick={() => removeMusterWindow(muster.rowKey)}
                        >
                          <HighlightOffIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Grid>
          {errorMessage && (
            <Grid item xs={12} className={classes.errorMessage}>
              {errorMessage}
            </Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions className={classes.dialogActions}>
        <Button disabled={formDisabled} variant="outlined" onClick={onClose} color="primary">
          Cancel
        </Button>
        <Button disabled={!canSave()} onClick={onSave} color="primary">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
  /* eslint-enable no-bitwise */
};
