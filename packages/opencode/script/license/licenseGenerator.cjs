const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');

const execAsync = promisify(exec);

/**
 * License生成器
 * 基于CPU ID或Machine ID生成license密钥
 */
class LicenseGenerator {
  constructor() {
    // 用于加密的密钥，实际项目中应该保密
    this.secretKey = 'hyper-aicode-secret-2024';
  }

  /**
   * 获取系统标识符（CPU ID或Machine ID）
   * @returns {Promise<string>} - 系统标识符
   */
  async getSystemId() {
    try {
      let stdout;
      
      if (os.platform() === 'win32') {
        // Windows系统使用wmic获取CPU ID
        const result = await execAsync("wmic cpu get processorid");
        stdout = result.stdout;
        const lines = stdout.split('\n').map(line => line.trim()).filter(line => line);
        
        // 跳过标题行，获取实际的CPU ID
        if (lines.length > 1) {
          return lines[1];
        }
      } else {
        // Linux/Unix系统使用machine-id
        const result = await execAsync("cat /etc/machine-id");
        stdout = result.stdout.trim();
        
        if (stdout) {
          return stdout;
        }
      }
      
      throw new Error("无法获取系统标识符");
    } catch (error) {
      console.error("获取系统标识符失败:", error);
      throw new Error("获取系统标识符失败");
    }
  }

  /**
   * 基于CPU ID生成license
   * @param {string} cpuId - CPU ID
   * @returns {string} - 生成的license字符串
   */
  generateLicense(cpuId) {
    try {
      // 创建基础数据，移除时间戳确保每个CPU ID生成固定密钥
      const baseData = `${cpuId}-${this.secretKey}`;
      
      // 使用SHA256生成哈希
      const hash = crypto.createHash('sha256').update(baseData).digest('hex');
      
      // 取前32位作为license的主体
      const licenseCore = hash.substring(0, 32);
      
      // 添加校验位和格式化
      const checksum = this.calculateChecksum(licenseCore);
      const formattedLicense = this.formatLicense(licenseCore, checksum);
      
      return formattedLicense;
    } catch (error) {
      console.error('生成license失败:', error);
      throw error;
    }
  }

  /**
   * 基于CPU ID与到期日生成集成到期的 license（到期参与计算并编码）
   * 末尾追加 “-YYYYMMDD”，其中 YYYYMMDD 也参与哈希
   * @param {string} cpuId
   * @param {Date} expiry
   * @returns {string}
   */
  generateLicenseWithExpiry(cpuId, expiry) {
    try {
      const yyyyMMdd = this.formatDateYYYYMMDD(expiry);
      const baseData = `${cpuId}-${this.secretKey}-${yyyyMMdd}`;
      const hash = crypto.createHash('sha256').update(baseData).digest('hex');
      const licenseCore = hash.substring(0, 32);
      const checksum = this.calculateChecksum(licenseCore);
      const formattedLicense = this.formatLicense(licenseCore, checksum);
      return `${formattedLicense}-${yyyyMMdd}`;
    } catch (error) {
      console.error('生成带到期license失败:', error);
      throw error;
    }
  }

  /**
   * 根据授权周期生成带有效期的 license（在末尾追加 EXP=YYYY-MM-DD）
   * @param {string} cpuId - 系统标识符
   * @param {('半个月'|'一个月'|'三个月'|'half-month'|'one-month'|'three-months')} durationType - 周期类型
   * @returns {string} - 生成的带有效期的 license
   */
  generateTimedLicense(cpuId, durationType) {
    const days = this.getDurationDays(durationType);
    const now = new Date();
    const expiry = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return this.generateLicenseWithExpiry(cpuId, expiry);
  }

  /**
   * 支持中文/英文周期映射
   * @param {string} durationType
   * @returns {number} days
   */
  getDurationDays(durationType) {
    switch (durationType) {
      case '半个月':
      case 'half-month':
        return 15;
      case '一个月':
      case 'one-month':
        return 30;
      case '三个月':
      case 'three-months':
        return 90;
      default:
        throw new Error(`Unsupported duration type: ${durationType}`);
    }
  }

  /**
   * 计算校验位
   * @param {string} data - 数据
   * @returns {string} - 校验位
   */
  calculateChecksum(data) {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data.charCodeAt(i);
    }
    return (sum % 1000).toString().padStart(3, '0');
  }

  /**
   * 格式化license字符串
   * @param {string} core - 核心字符串
   * @param {string} checksum - 校验位
   * @returns {string} - 格式化的license
   */
  formatLicense(core, checksum) {
    // 将核心字符串分组，每4个字符一组
    const groups = [];
    for (let i = 0; i < core.length; i += 4) {
      groups.push(core.substring(i, i + 4));
    }
    
    // 添加校验位并用连字符连接
    return `${groups.join('-')}-${checksum}`;
  }

  /**
   * 验证license是否对应指定的CPU ID
   * @param {string} license - license字符串
   * @param {string} cpuId - CPU ID
   * @returns {boolean} - 是否有效
   */
  validateLicense(license, cpuId) {
    try {
      // 兼容后缀，但优先解析内嵌到期（-YYYYMMDD）
      const raw = license.trim();
      const basePart = raw.replace(/\|EXP=[^|]+/i, '').trim();
      const clean = basePart.replace(/-/g, '');

      if (clean.length !== 35 && clean.length !== 43) {
        return false;
      }

      const core = clean.substring(0, 32);
      const checksum = clean.substring(32, 35);
      const expField = clean.length === 43 ? clean.substring(35, 43) : undefined;

      const expectedChecksum = this.calculateChecksum(core);
      if (checksum !== expectedChecksum) {
        return false;
      }

      let expiry;
      if (expField) {
        if (!/^\d{8}$/.test(expField)) return false;
        const yyyy = parseInt(expField.slice(0, 4), 10);
        const mm = parseInt(expField.slice(4, 6), 10);
        const dd = parseInt(expField.slice(6, 8), 10);
        expiry = new Date(`${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}T00:00:00`);
        if (isNaN(expiry.getTime())) return false;
      } else {
        // 若仅有后缀
        const m = raw.match(/\|EXP=(\d{4}-\d{2}-\d{2})/i);
        if (m) {
          expiry = new Date(m[1] + 'T00:00:00');
          if (isNaN(expiry.getTime())) return false;
        }
      }

      const expected = expiry ? this.generateLicenseWithExpiry(cpuId, expiry) : this.generateLicense(cpuId);
      if (basePart !== expected) return false;

      if (expiry) {
        const now = new Date();
        if (now.getTime() > expiry.getTime()) return false;
      }

      return true;
    } catch (error) {
      console.error('验证license失败:', error);
      return false;
    }
  }

  /**
   * 格式化日期为 YYYYMMDD
   * @param {Date} d
   * @returns {string}
   */
  formatDateYYYYMMDD(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
  }
}

// 测试程序
async function testLicenseGenerator() {
  const generator = new LicenseGenerator();
  
  console.log('=== License生成器测试 ===');
  console.log(`操作系统: ${os.platform()}`);
  
  try {
    // 自动获取系统标识符
    const systemId = await generator.getSystemId();
    console.log(`系统标识符: ${systemId}`);
    
    // 生成license
    const license = generator.generateLicense(systemId);
    console.log(`生成的License: ${license}`);
    
    // 验证license
    const isValid = generator.validateLicense(license, systemId);
    console.log(`License验证结果: ${isValid ? '有效' : '无效'}`);
    
    // 生成多个license进行测试（应该都相同）
    console.log('\n=== 生成多个License进行测试（应该都相同） ===');
    for (let i = 0; i < 3; i++) {
      const newLicense = generator.generateLicense(systemId);
      console.log(`License ${i + 1}: ${newLicense}`);
    }

    // 生成带有效期的 license 示例
    console.log('\n=== 生成带有效期的 License 示例 ===');
    const halfMonth = generator.generateTimedLicense(systemId, '半个月');
    const oneMonth = generator.generateTimedLicense(systemId, '一个月');
    const threeMonths = generator.generateTimedLicense(systemId, '三个月');
    console.log(`半个月: ${halfMonth}`);
    console.log(`一个月: ${oneMonth}`);
    console.log(`三个月: ${threeMonths}`);

    // 测试Windows示例CPU ID（如果当前不是Windows）
    if (os.platform() !== 'win32') {
      console.log('\n=== 测试Windows示例CPU ID ===');
      const testCpuId = 'BFEBFBFF000B0671';
      const testLicense = generator.generateLicense(testCpuId);
      console.log(`Windows CPU ID: ${testCpuId}`);
      console.log(`生成的License: ${testLicense}`);
      console.log(`验证结果: ${generator.validateLicense(testLicense, testCpuId) ? '有效' : '无效'}`);

      // Timed for Windows sample
      console.log('\n=== 带有效期（示例CPU ID） ===');
      console.log('半个月:', generator.generateTimedLicense(testCpuId, 'half-month'));
      console.log('一个月:', generator.generateTimedLicense(testCpuId, 'one-month'));
      console.log('三个月:', generator.generateTimedLicense(testCpuId, 'three-months'));
    }
    
    return license;
  } catch (error) {
    console.error('测试失败:', error);
    
    // 如果获取系统标识符失败，使用示例ID进行测试
    console.log('\n=== 使用示例ID进行测试 ===');
    const testId = os.platform() === 'win32' ? 'BFEBFBFF000B0671' : 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';
    console.log(`示例ID: ${testId}`);
    
    const license = generator.generateLicense(testId);
    console.log(`生成的License: ${license}`);
    console.log(`验证结果: ${generator.validateLicense(license, testId) ? '有效' : '无效'}`);
    
    return license;
  }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  testLicenseGenerator().catch(console.error);
}

module.exports = { LicenseGenerator, testLicenseGenerator };