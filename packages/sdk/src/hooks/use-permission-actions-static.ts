/* eslint-disable @typescript-eslint/naming-convention */
import type { AllActions } from '@teable/core';
import { ActionPrefix } from '@teable/core';
import { useMemo } from 'react';
import { useTranslation } from '../context/app/i18n';
import type { TKey } from '../context/app/i18n';

const actionsI18nMap: Record<
  AllActions,
  {
    description: TKey;
  }
> = {
  'space|create': {
    description: 'permission.actionDescription.spaceCreate',
  },
  'space|delete': {
    description: 'permission.actionDescription.spaceDelete',
  },
  'space|read': {
    description: 'permission.actionDescription.spaceRead',
  },
  'space|update': {
    description: 'permission.actionDescription.spaceUpdate',
  },
  'space|invite_email': {
    description: 'permission.actionDescription.spaceInviteEmail',
  },
  'space|invite_link': {
    description: 'permission.actionDescription.spaceInviteLink',
  },
  'space|grant_role': {
    description: 'permission.actionDescription.spaceGrantRole',
  },
  'base|create': {
    description: 'permission.actionDescription.baseCreate',
  },
  'base|delete': {
    description: 'permission.actionDescription.baseDelete',
  },
  'base|read': {
    description: 'permission.actionDescription.baseRead',
  },
  'base|update': {
    description: 'permission.actionDescription.baseUpdate',
  },
  'base|invite_email': {
    description: 'permission.actionDescription.baseInviteEmail',
  },
  'base|invite_link': {
    description: 'permission.actionDescription.baseInviteLink',
  },
  'table|create': {
    description: 'permission.actionDescription.tableCreate',
  },
  'table|read': {
    description: 'permission.actionDescription.tableRead',
  },
  'table|delete': {
    description: 'permission.actionDescription.tableDelete',
  },
  'table|update': {
    description: 'permission.actionDescription.tableUpdate',
  },
  'table|import': {
    description: 'permission.actionDescription.tableImport',
  },
  'view|create': {
    description: 'permission.actionDescription.viewCreate',
  },
  'view|delete': {
    description: 'permission.actionDescription.viewDelete',
  },
  'view|read': {
    description: 'permission.actionDescription.viewRead',
  },
  'view|update': {
    description: 'permission.actionDescription.viewUpdate',
  },
  'field|create': {
    description: 'permission.actionDescription.fieldCreate',
  },
  'field|delete': {
    description: 'permission.actionDescription.fieldDelete',
  },
  'field|read': {
    description: 'permission.actionDescription.fieldRead',
  },
  'field|update': {
    description: 'permission.actionDescription.fieldUpdate',
  },
  'record|create': {
    description: 'permission.actionDescription.recordCreate',
  },
  'record|comment': {
    description: 'permission.actionDescription.recordComment',
  },
  'record|delete': {
    description: 'permission.actionDescription.recordDelete',
  },
  'record|read': {
    description: 'permission.actionDescription.recordRead',
  },
  'record|update': {
    description: 'permission.actionDescription.recordUpdate',
  },
};

const actionPrefixI18nMap: Record<ActionPrefix, { title: TKey }> = {
  [ActionPrefix.Base]: {
    title: 'noun.base',
  },
  [ActionPrefix.Space]: {
    title: 'noun.space',
  },
  [ActionPrefix.Table]: {
    title: 'noun.table',
  },
  [ActionPrefix.View]: {
    title: 'noun.view',
  },
  [ActionPrefix.Field]: {
    title: 'noun.field',
  },
  [ActionPrefix.Record]: {
    title: 'noun.record',
  },
};

export const usePermissionActionsStatic = () => {
  const { t } = useTranslation();
  return useMemo(() => {
    const actionStaticMap = Object.keys(actionsI18nMap).reduce(
      (acc, key) => {
        const action = key as AllActions;
        acc[action] = {
          description: t(actionsI18nMap[action].description),
        };
        return acc;
      },
      {} as Record<AllActions, { description: string }>
    );
    const actionPrefixStaticMap = Object.values(ActionPrefix).reduce(
      (acc, prefix) => {
        acc[prefix] = {
          title: t(actionPrefixI18nMap[prefix].title),
        };
        return acc;
      },
      {} as Record<ActionPrefix, { title: string }>
    );
    return { actionStaticMap, actionPrefixStaticMap };
  }, [t]);
};
