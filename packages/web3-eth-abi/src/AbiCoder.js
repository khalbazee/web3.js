/*
    This file is part of web3.js.

    web3.js is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    web3.js is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with web3.js.  If not, see <http://www.gnu.org/licenses/>.
*/
/**
 * @file index.js
 * @author Marek Kotewicz <marek@parity.io>
 * @author Fabian Vogelsteller <fabian@frozeman.de>
 * @date 2018
 */

import isArray from 'lodash/isArray';
import isObject from 'lodash/isObject';

// TODO: Implement it by our self this can't be a dependency because of the importance of it.
export default class AbiCoder {
    /**
     * @param {Utils} utils
     * @param {EthersAbiCoder} ethersAbiCoder
     *
     * @constructor
     */
    constructor(utils, ethersAbiCoder) {
        this.utils = utils;
        this.ethersAbiCoder = ethersAbiCoder;
    }

    /**
     * Encodes the function name to its ABI representation, which are the first 4 bytes of the sha3 of the function name including  types.
     *
     * @method encodeFunctionSignature
     *
     * @param {String|Object} functionName
     *
     * @returns {String} encoded function name
     */
    encodeFunctionSignature(functionName) {
        if (isObject(functionName)) {
            functionName = this.utils.jsonInterfaceMethodToString(functionName);
        }

        return this.utils.sha3(functionName).slice(0, 10);
    }

    /**
     * Encodes the function name to its ABI representation, which are the first 4 bytes of the sha3 of the function name including  types.
     *
     * @method encodeEventSignature
     *
     * @param {String|Object} functionName
     *
     * @returns {String} encoded function name
     */
    encodeEventSignature(functionName) {
        if (isObject(functionName)) {
            functionName = this.utils.jsonInterfaceMethodToString(functionName);
        }

        return this.utils.sha3(functionName);
    }

    /**
     * Should be used to encode plain param
     *
     * @method encodeParameter
     *
     * @param {String} type
     * @param {Object} param
     *
     * @returns {String} encoded plain param
     */
    encodeParameter(type, param) {
        return this.encodeParameters([type], [param]);
    }

    /**
     * Should be used to encode list of params
     *
     * @method encodeParameters
     *
     * @param {Array} types
     * @param {Array} params
     *
     * @returns {String} encoded list of params
     */
    encodeParameters(types, params) {
        return this.ethersAbiCoder.encode(types, params);
    }

    /**
     * Encodes a function call from its json interface and parameters.
     *
     * @method encodeFunctionCall
     *
     * @param {Object} jsonInterface
     * @param {Array} params
     *
     * @returns {String} The encoded ABI for this function call
     */
    encodeFunctionCall(jsonInterface, params) {
        return (
            this.encodeFunctionSignature(jsonInterface) +
            this.encodeParameters(jsonInterface.inputs, params).replace('0x', '')
        );
    }

    /**
     * Should be used to decode bytes to plain param
     *
     * @method decodeParameter
     *
     * @param {String} type
     * @param {String} bytes
     *
     * @returns {Object} plain param
     */
    decodeParameter(type, bytes) {
        return this.decodeParameters([type], bytes)[0];
    }

    /**
     * Should be used to decode list of params
     *
     * @method decodeParameter
     *
     * @param {Array<String|Object>|Object} outputs
     * @param {String} bytes
     *
     * @returns {Object} Object with named and indexed properties of the returnValues
     */
    decodeParameters(outputs, bytes) {
        if (isArray(outputs) && outputs.length === 0) {
            throw new Error('Empty outputs array given!');
        }

        if (!bytes || bytes === '0x' || bytes === '0X') {
            throw new Error(`Invalid bytes string given: ${bytes}`);
        }

        const result = this.ethersAbiCoder.decode(outputs, bytes);
        let returnValues = {};

        if (outputs.length > 1) {
            let decodedValue;
            outputs.forEach((output, i) => {
                decodedValue = result[i];

                if (decodedValue === '0x') {
                    decodedValue = null;
                }

                returnValues[i] = decodedValue;

                if (isObject(output) && output.name) {
                    returnValues[output.name] = decodedValue;
                }
            });

            return returnValues;
        }

        returnValues = {0: result};
        returnValues[outputs[0].name] = result;

        return returnValues;
    }

    /**
     * Decodes events non- and indexed parameters.
     *
     * @method decodeLog
     *
     * @param {Array} inputs
     * @param {String} data
     * @param {Array} topics
     *
     * @returns {Object} Object with named and indexed properties of the returnValues
     */
    decodeLog(inputs, data = '', topics) {
        const returnValues = {};
        let topicCount = 0;
        let value;
        let nonIndexedInputKeys = [];

        if (!isArray(topics)) {
            topics = [topics];
        }

        inputs.forEach((input, i) => {
            if (input.indexed) {
                value = topics[topicCount];

                if (this.isStaticType(input.type)) {
                    value = this.decodeParameter(input, topics[topicCount]);

                    topicCount++;
                }

                if (input.type === 'string') {
                    return;
                }

                returnValues[i] = value;
                returnValues[input.name] = value;

                return;
            }

            nonIndexedInputKeys.push({key: i, input: input});
        });

        if (data) {
            nonIndexedInputKeys.forEach((item) => {
                value = this.decodeParameter(item.input, data);
                returnValues[item.key] = value;
                returnValues[item.input.name] = value;
            });
        }

        return returnValues;
    }

    /**
     * Checks if a given type string is a static solidity type
     *
     * @method isStaticType
     *
     * @param {String} type
     *
     * @returns {Boolean}
     */
    isStaticType(type) {
        switch (type) {
            case 'bytes':
                return false;
            case (type.indexOf('[') || type.indexOf('(')):
                return false;
            case 'string':
                return false;
            default:
                return true;
        }
    }
}
