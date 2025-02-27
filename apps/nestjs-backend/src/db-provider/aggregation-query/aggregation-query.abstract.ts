import { BadRequestException, Logger } from '@nestjs/common';
import type { IAggregationField } from '@teable/core';
import { CellValueType, DbFieldType, getValidStatisticFunc } from '@teable/core';
import type { Knex } from 'knex';
import type { IFieldInstance } from '../../features/field/model/factory';
import type { IAggregationQueryExtra } from '../db.provider.interface';
import type { AbstractAggregationFunction } from './aggregation-function.abstract';
import type { IAggregationQueryInterface } from './aggregation-query.interface';

export abstract class AbstractAggregationQuery implements IAggregationQueryInterface {
  private logger = new Logger(AbstractAggregationQuery.name);

  constructor(
    protected readonly knex: Knex,
    protected readonly originQueryBuilder: Knex.QueryBuilder,
    protected readonly dbTableName: string,
    protected readonly fields?: { [fieldId: string]: IFieldInstance },
    protected readonly aggregationFields?: IAggregationField[],
    protected readonly extra?: IAggregationQueryExtra
  ) {}

  toQuerySql(): string {
    const queryBuilder = this.originQueryBuilder;

    if (!this.aggregationFields || !this.aggregationFields.length) {
      return queryBuilder.toQuery();
    }

    this.validAggregationField(this.aggregationFields, this.extra);

    this.aggregationFields.forEach(({ fieldId, statisticFunc }) => {
      const field = this.fields && this.fields[fieldId];
      if (!field) {
        return queryBuilder;
      }

      this.getAggregationAdapter(field).compiler(queryBuilder, statisticFunc);
    });

    const aggSql = queryBuilder.toQuery();
    this.logger.debug('toQuerySql AggSql: %s', aggSql);
    return aggSql;
  }

  private validAggregationField(
    aggregationFields: IAggregationField[],
    _extra?: IAggregationQueryExtra
  ) {
    aggregationFields.forEach(({ fieldId, statisticFunc }) => {
      const field = this.fields && this.fields[fieldId];

      if (!field) {
        throw new BadRequestException(`field: '${fieldId}' is invalid`);
      }

      const validStatisticFunc = getValidStatisticFunc(field);
      if (statisticFunc && !validStatisticFunc.includes(statisticFunc)) {
        throw new BadRequestException(
          `field: '${fieldId}', aggregation func: '${statisticFunc}' is invalid, Only the following func are allowed: [${validStatisticFunc}]`
        );
      }
    });
  }

  private getAggregationAdapter(field: IFieldInstance): AbstractAggregationFunction {
    const { dbFieldType } = field;
    switch (field.cellValueType) {
      case CellValueType.Boolean:
        return this.booleanAggregation(field);
      case CellValueType.Number:
        return this.numberAggregation(field);
      case CellValueType.DateTime:
        return this.dateTimeAggregation(field);
      case CellValueType.String: {
        if (dbFieldType === DbFieldType.Json) {
          return this.jsonAggregation(field);
        }
        return this.stringAggregation(field);
      }
    }
  }

  abstract booleanAggregation(field: IFieldInstance): AbstractAggregationFunction;

  abstract numberAggregation(field: IFieldInstance): AbstractAggregationFunction;

  abstract dateTimeAggregation(field: IFieldInstance): AbstractAggregationFunction;

  abstract stringAggregation(field: IFieldInstance): AbstractAggregationFunction;

  abstract jsonAggregation(field: IFieldInstance): AbstractAggregationFunction;
}
