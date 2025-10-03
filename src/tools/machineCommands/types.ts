/**
 * TypeScript interfaces for machine command data structures
 */

/**
 * Machine command parameter structure
 */
export interface MachineCommandParameter {
  machine_variable_id: string;
  value: string;
  allow_override: boolean;
  label: string;
}

/**
 * Machine command response from API
 */
export interface MachineCommandResponse {
  id: string;
  name: string;
  parameters: Array<{
    value: string;
    machine_variable_id: string;
    allow_override: boolean;
  }>;
  machine_variables: Array<unknown>; // Type to be determined based on API response
}

/**
 * Request body for creating a machine command
 */
export interface CreateMachineCommandRequest {
  machine_command: {
    name: string;
    parameters: MachineCommandParameter[];
  };
}

/**
 * Request body for updating a machine command
 */
export interface UpdateMachineCommandRequest {
  machine_command: {
    name?: string;
    parameters?: MachineCommandParameter[];
  };
}

/**
 * Input type for machine command creation
 */
export interface MachineCommandCreateInput {
  machine_firmware_id: string;
  name: string;
  parameters: MachineCommandParameter[];
}

/**
 * Input type for machine command update
 */
export interface MachineCommandUpdateInput {
  machine_command_id: string;
  name?: string;
  parameters?: MachineCommandParameter[];
}

/**
 * Input type for machine command deletion
 */
export interface MachineCommandDeleteInput {
  machine_command_id: string;
}

/**
 * Input type for machine command execution
 */
export interface MachineCommandExecuteInput {
  device_id: string;
  machine_command_id: string;
  overrides?: Record<string, string>;
}

/**
 * Request body for executing a machine command
 */
export interface ExecuteMachineCommandRequest {
  overrides?: Record<string, string>;
}